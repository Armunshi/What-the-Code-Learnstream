// The service layer search.routes.js calls into — one function per endpoint
// in D6's table. Text matching/facets live in engine.js, ranking in rank.js/
// relevance.js, and the rule-based extras (trending/related/fresh/spotlight)
// each have their own module; this file is just the composition + DTO
// mapping step for all of them.
import { User } from "../../models/user.model.js";
import { SearchEvent } from "../../models/searchEvent.model.js";
import { SearchQuery } from "../../models/searchQuery.model.js";
import { toCourseCardDTO, toCourseCardDTOs } from "../../utils/dto/courseCard.js";
import {
  SORT_OPTIONS,
  SUGGEST_COURSE_LIMIT,
  SUGGEST_INSTRUCTOR_LIMIT,
  SUGGEST_KEYPHRASE_LIMIT,
} from "../../config/search.js";
import { normalizeQuery, tokenize, wordPrefixRegExp } from "./text.js";
import { rankedCandidates } from "./rank.js";
import { computeSpotlight } from "./spotlight.js";

export { getTrendingQueries } from "./trending.js";
export { getRelatedQueries } from "./related.js";
export { getFreshCourses } from "./fresh.js";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 48;

function paginationParams({ page, limit } = {}) {
  return {
    page: Math.max(1, Number.isFinite(+page) ? Math.trunc(+page) : 1),
    limit: Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(+limit) ? Math.trunc(+limit) : DEFAULT_LIMIT)),
  };
}

/** Reshapes an engine candidate (a lean $facet projection with
 * authorId/authorName/authorUsername flattened by engine.mongo.js's
 * $lookup) into what courseCard.js's DTO mapper expects. */
const withAuthor = (candidate) => ({
  ...candidate,
  author: { _id: candidate.authorId, name: candidate.authorName, username: candidate.authorUsername },
});

const SORT_COMPARATORS = {
  highest_rated: (a, b) => (b.stats?.ratingAvg ?? 0) - (a.stats?.ratingAvg ?? 0),
  most_reviewed: (a, b) => (b.stats?.ratingCount ?? 0) - (a.stats?.ratingCount ?? 0),
  newest: (a, b) => new Date(b.publishedAt ?? 0) - new Date(a.publishedAt ?? 0),
};

/** GET /courses/search — D6's table. `sort` defaults to relevance
 * (rankedCandidates' own order); any other SORT_OPTIONS value re-orders the
 * same capped candidate set rather than re-querying. */
export async function searchCourses({ q, filters = {}, sort, page, limit }) {
  const { page: p, limit: l } = paginationParams({ page, limit });
  const { scored, total, facets, relaxed } = await rankedCandidates(q, filters);

  const ordered =
    sort && SORT_OPTIONS.includes(sort) && SORT_COMPARATORS[sort]
      ? [...scored].sort(SORT_COMPARATORS[sort])
      : scored;

  const pageSlice = ordered.slice((p - 1) * l, (p - 1) * l + l);
  const items = toCourseCardDTOs(pageSlice.map(withAuthor));

  let spotlight = null;
  if (scored.length > 0) {
    const top = { ...scored[0], _card: toCourseCardDTO(withAuthor(scored[0])) };
    const second = scored[1] ? { ...scored[1] } : undefined;
    spotlight = computeSpotlight(second ? [top, second] : [top], q);
  }

  return { items, total, page: p, limit: l, facets, spotlight, relaxed };
}

/** GET /courses/search/suggest — D6's table. Three independent lookups,
 * not derived from one query, since "recent popular queries", "matching
 * courses" and "matching instructors" have nothing in common structurally. */
export async function getSuggestions(q) {
  const normalizedQuery = normalizeQuery(q);
  const tokens = tokenize(q);
  if (!normalizedQuery || tokens.length === 0) {
    return { keyphrases: [], courses: [], instructors: [] };
  }

  const [keyphraseRows, { scored }, instructorRows] = await Promise.all([
    SearchQuery.find({ q: new RegExp(`^${escapeForRegex(normalizedQuery)}`, "i") })
      .sort({ searchCount: -1 })
      .limit(SUGGEST_KEYPHRASE_LIMIT)
      .lean(),
    rankedCandidates(q, {}),
    User.find({
      role: "teacher",
      $or: tokens.map((t) => ({ $or: [{ name: wordPrefixRegExp(t) }, { username: wordPrefixRegExp(t) }] })),
    })
      .select("username name avatar headline")
      .limit(SUGGEST_INSTRUCTOR_LIMIT)
      .lean(),
  ]);

  return {
    keyphrases: keyphraseRows.map((r) => r.displayQ),
    courses: scored.slice(0, SUGGEST_COURSE_LIMIT).map((c) => ({
      id: String(c._id),
      title: c.title,
      thumbnailUrl: c.thumbnail ?? null,
      authorName: c.authorName ?? null,
    })),
    instructors: instructorRows.map((u) => ({
      id: String(u._id),
      username: u.username ?? null,
      name: u.name,
      avatar: u.avatar ?? null,
      headline: u.headline ?? null,
    })),
  };
}

function escapeForRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** POST /courses/search/events — writes the raw log entry (SearchEvent) and
 * upserts the per-query aggregate (SearchQuery) trending.js and related.js
 * each read. */
export async function logSearchEvent({ q, resultCount, sessionId }) {
  const normalizedQuery = normalizeQuery(q);
  if (!normalizedQuery) return;

  await SearchEvent.create({ q: q.trim(), resultCount, sessionId });
  await SearchQuery.findOneAndUpdate(
    { q: normalizedQuery },
    {
      $set: { displayQ: q.trim(), lastResultCount: resultCount, lastSearchedAt: new Date() },
      $inc: { searchCount: 1 },
    },
    { upsert: true }
  );
}
