// Rule-based Trending (§6.4). Reads the raw SearchEvent log directly rather
// than the SearchQuery aggregate (see searchQuery.model.js's own comment) —
// "top queries over 7 days with at least 3 distinct sessions and results
// greater than 0" needs an exact time window and a distinct-session count
// per query, which only the raw per-event rows can answer without drift.
import { SearchEvent } from "../../models/searchEvent.model.js";
import {
  DENYLIST,
  TRENDING_LIMIT,
  TRENDING_MIN_DISTINCT_SESSIONS,
  TRENDING_SEEDS,
  TRENDING_WINDOW_DAYS,
} from "../../config/search.js";
import { normalizeQuery } from "./text.js";

const isDenied = (q) => DENYLIST.includes(normalizeQuery(q));

export async function getTrendingQueries() {
  const since = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const rows = await SearchEvent.aggregate([
    { $match: { at: { $gte: since }, resultCount: { $gt: 0 } } },
    {
      $group: {
        _id: { $toLower: { $trim: { input: "$q" } } },
        displayQ: { $first: "$q" },
        sessions: { $addToSet: "$sessionId" },
      },
    },
    { $addFields: { sessionCount: { $size: "$sessions" } } },
    { $match: { sessionCount: { $gte: TRENDING_MIN_DISTINCT_SESSIONS } } },
    { $sort: { sessionCount: -1 } },
    { $limit: TRENDING_LIMIT * 2 }, // headroom before the JS denylist filter below
  ]);

  const real = rows.filter((r) => !isDenied(r._id)).map((r) => r.displayQ.trim());

  const queries = [...real];
  const seen = new Set(queries.map((q) => normalizeQuery(q)));
  for (const seed of TRENDING_SEEDS) {
    if (queries.length >= TRENDING_LIMIT) break;
    if (seen.has(normalizeQuery(seed))) continue;
    queries.push(seed);
    seen.add(normalizeQuery(seed));
  }

  return queries.slice(0, TRENDING_LIMIT);
}
