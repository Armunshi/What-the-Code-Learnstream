// Shared "find + score + sort" step used by both the main search (index.js)
// and related.js's step 3 (topic labels of the top results for `q`) — kept
// out of index.js so related.js doesn't have to import the route-facing
// search function just to reuse its ranking half.
import { findCandidates } from "./engine.js";
import { compareByRelevance, scoreCandidate } from "./relevance.js";

export async function rankedCandidates(q, filters = {}) {
  const { candidates, total, facets, relaxed } = await findCandidates({ q, filters });
  const scored = candidates.map((c) => ({ ...c, _score: scoreCandidate(c, q) }));
  scored.sort(compareByRelevance);
  return { scored, total, facets, relaxed };
}
