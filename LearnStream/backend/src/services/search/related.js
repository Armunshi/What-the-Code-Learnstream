// Rule-based Related searches (§6.4, FR-SRC-4.1), tried in order until
// RELATED_LIMIT queries are gathered:
//   1. Queries that co-occur with `q` in the same session within 30 minutes.
//   2. Prefix and token overlap against the SearchQuery aggregate.
//   3. Topic labels of the top results for `q`.
import { SearchEvent } from "../../models/searchEvent.model.js";
import { SearchQuery } from "../../models/searchQuery.model.js";
import { findCategory } from "../../config/taxonomy.js";
import { DENYLIST, RELATED_COOCCURRENCE_WINDOW_MIN, RELATED_LIMIT } from "../../config/search.js";
import { normalizeQuery, tokenize } from "./text.js";
import { rankedCandidates } from "./rank.js";

const isDenied = (q) => DENYLIST.includes(normalizeQuery(q));
const windowMs = RELATED_COOCCURRENCE_WINDOW_MIN * 60 * 1000;

/** Step 1: other queries seen in the same session, within 30 min either
 * side of when `q` itself was searched in that session. */
async function coOccurring(normalizedQuery) {
  const anchors = await SearchEvent.find({ q: new RegExp(`^${escapeForFind(normalizedQuery)}$`, "i") })
    .select("sessionId at")
    .limit(200)
    .lean();
  if (anchors.length === 0) return [];

  const orClauses = anchors.map((a) => ({
    sessionId: a.sessionId,
    at: { $gte: new Date(a.at.getTime() - windowMs), $lte: new Date(a.at.getTime() + windowMs) },
  }));

  const nearby = await SearchEvent.find({ $or: orClauses }).select("q").limit(2000).lean();

  const counts = new Map();
  for (const row of nearby) {
    const norm = normalizeQuery(row.q);
    if (norm === normalizedQuery || isDenied(norm)) continue;
    counts.set(norm, (counts.get(norm) ?? { display: row.q.trim(), count: 0 }));
    counts.get(norm).count += 1;
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).map((c) => c.display);
}

function escapeForFind(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Step 2: other popular queries sharing a token or a prefix with `q`. */
async function prefixAndTokenOverlap(normalizedQuery, tokens) {
  const candidates = await SearchQuery.find({ q: { $ne: normalizedQuery } })
    .sort({ searchCount: -1 })
    .limit(200)
    .lean();

  const scored = candidates
    .map((c) => {
      const otherTokens = tokenize(c.displayQ);
      const overlap = otherTokens.filter((t) => tokens.includes(t)).length;
      const prefixHit = c.q.startsWith(normalizedQuery) || normalizedQuery.startsWith(c.q) ? 1 : 0;
      return { display: c.displayQ.trim(), rank: overlap * 2 + prefixHit, searchCount: c.searchCount };
    })
    .filter((c) => c.rank > 0 && !isDenied(c.display));

  scored.sort((a, b) => b.rank - a.rank || b.searchCount - a.searchCount);
  return scored.map((c) => c.display);
}

/** Step 3: topic/category labels drawn from the top results `q` itself returns. */
async function topResultLabels(q) {
  const { scored } = await rankedCandidates(q, {});
  const labels = [];
  for (const candidate of scored.slice(0, 5)) {
    const category = findCategory(candidate.category);
    if (category && !labels.includes(category.label)) labels.push(category.label);
    for (const topic of candidate.topics ?? []) {
      const label = topic.replace(/-/g, " ");
      if (!labels.includes(label)) labels.push(label);
    }
  }
  return labels;
}

export async function getRelatedQueries(q) {
  const normalizedQuery = normalizeQuery(q);
  if (!normalizedQuery) return [];
  const tokens = tokenize(q);

  const queries = [];
  const seen = new Set();
  const add = (list) => {
    for (const item of list) {
      const norm = normalizeQuery(item);
      if (norm === normalizedQuery || seen.has(norm)) continue;
      seen.add(norm);
      queries.push(item);
      if (queries.length >= RELATED_LIMIT) return true;
    }
    return false;
  };

  if (add(await coOccurring(normalizedQuery))) return queries;
  if (add(await prefixAndTokenOverlap(normalizedQuery, tokens))) return queries;
  add(await topResultLabels(q));
  return queries.slice(0, RELATED_LIMIT);
}
