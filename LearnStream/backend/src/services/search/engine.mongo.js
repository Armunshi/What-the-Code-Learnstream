// D6's engine.mongo.js — today's search implementation, behind the
// engine.js swap point. Everything here is MongoDB regex + `$facet`
// (D6 "Search stays on MongoDB, not Atlas Search"): candidate matching and
// disjunctive facet counts run as one aggregation, and per-document
// relevance scoring/sorting happens in JS afterward (over at most
// CANDIDATE_CAP documents) — see relevance.js.
import { Courses } from "../../models/course.model.js";
import { COURSE_STATUS } from "../../config/courseLifecycle.js";
import { TAXONOMY } from "../../config/taxonomy.js";
import { CANDIDATE_CAP, DURATION_BUCKETS, levelFilterToModelLevels } from "../../config/search.js";
import { tokenize, wordPrefixRegExp } from "./text.js";

// $switch branches mapping a category slug to its display label — built
// once from the taxonomy, not per request. Falls back to the raw slug for a
// course whose category isn't in the (frozen) taxonomy list, so scoring
// never throws over stale data.
const CATEGORY_LABEL_SWITCH = {
  branches: TAXONOMY.map((c) => ({ case: { $eq: ["$category", c.slug] }, then: c.label })),
  default: { $ifNull: ["$category", ""] },
};

/** Word-prefix regex match against a field that may be a string or an array
 * of strings — Mongo's $regex on an array field matches if ANY element
 * matches, which is exactly "somewhere in topics" (D6). */
const tokenMatchClause = (token) => {
  const re = wordPrefixRegExp(token);
  return {
    $or: [
      { title: re },
      { subtitle: re },
      { description: re },
      { topics: re },
      { categoryLabel: re },
      { authorName: re },
    ],
  };
};

/**
 * D6's matching rule: every token must match (word-prefix, escaped,
 * case-insensitive) somewhere in the searchable text; if that yields
 * nothing, fall back to "any token matches" and the caller flags the
 * response `relaxed: true`.
 *
 * Returns `{ strict, relaxed }` — both are Mongo match fragments (or `null`
 * for an empty query, meaning "no text restriction at all").
 */
function buildTextMatch(query) {
  const tokens = tokenize(query);
  if (tokens.length === 0) return { strict: null, relaxed: null };
  return {
    strict: { $and: tokens.map(tokenMatchClause) },
    relaxed: { $or: tokens.map(tokenMatchClause) },
  };
}

function buildFilterFragment(key, filters) {
  switch (key) {
    case "cert":
      return filters.cert ? { isCertificationPrep: true } : null;
    case "rating":
      return filters.rating ? { "stats.ratingAvg": { $gte: Number(filters.rating) } } : null;
    case "lang":
      return filters.lang?.length ? { language: { $in: filters.lang } } : null;
    case "practice":
      return filters.practice?.length ? { "stats.practiceTypes": { $in: filters.practice } } : null;
    case "duration": {
      if (!filters.duration) return null;
      const bucket = DURATION_BUCKETS[filters.duration];
      if (!bucket) return null;
      const cond = { $gte: bucket.min };
      if (Number.isFinite(bucket.max)) cond.$lt = bucket.max;
      return { "stats.totalDurationSec": cond };
    }
    case "topic":
      return filters.topic?.length ? { topics: { $in: filters.topic } } : null;
    case "level":
      return filters.level?.length
        ? { level: { $in: filters.level.flatMap(levelFilterToModelLevels) } }
        : null;
    case "subs":
      return filters.subs?.length ? { "stats.captionLanguages": { $in: filters.subs } } : null;
    case "price": {
      const selected = filters.price ?? [];
      if (selected.length === 0 || selected.length === 2) return null; // both/neither = no filter
      return selected[0] === "free" ? { price: 0 } : { price: { $gt: 0 } };
    }
    default:
      return null;
  }
}

const FILTER_KEYS = ["cert", "rating", "lang", "practice", "duration", "topic", "level", "subs", "price"];

/** All active filter fragments except `excludeKey` — the disjunctive-facet rule (D6). */
function combinedFilters(filters, excludeKey) {
  const fragments = FILTER_KEYS.filter((k) => k !== excludeKey)
    .map((k) => buildFilterFragment(k, filters))
    .filter(Boolean);
  return fragments.length ? { $and: fragments } : {};
}

function matchStage(textMatch, filters, excludeKey) {
  const clauses = [{ status: COURSE_STATUS.PUBLISHED }];
  if (textMatch) clauses.push(textMatch);
  const filterClause = combinedFilters(filters, excludeKey);
  if (filterClause.$and) clauses.push(...filterClause.$and);
  return { $match: { $and: clauses } };
}

// $group stages for each facet's own dimension, run against the
// "every OTHER filter + text applied" set (matchStage(..., excludeKey)).
function facetGroupPipeline(key) {
  switch (key) {
    case "cert":
      return [{ $group: { _id: null, count: { $sum: { $cond: ["$isCertificationPrep", 1, 0] } } } }];
    case "rating":
      // $group accumulator keys can't contain "." (Mongo rejects a literal
      // field name like "4.5"), so these use safe keys and formatFacetResult
      // maps them back to the "4.5"/"4.0"/... response shape RATING_OPTIONS uses.
      return [
        {
          $group: {
            _id: null,
            r45: { $sum: { $cond: [{ $gte: ["$stats.ratingAvg", 4.5] }, 1, 0] } },
            r40: { $sum: { $cond: [{ $gte: ["$stats.ratingAvg", 4.0] }, 1, 0] } },
            r35: { $sum: { $cond: [{ $gte: ["$stats.ratingAvg", 3.5] }, 1, 0] } },
            r30: { $sum: { $cond: [{ $gte: ["$stats.ratingAvg", 3.0] }, 1, 0] } },
          },
        },
      ];
    case "lang":
      return [{ $group: { _id: "$language", count: { $sum: 1 } } }];
    case "practice":
      return [
        { $unwind: "$stats.practiceTypes" },
        { $group: { _id: "$stats.practiceTypes", count: { $sum: 1 } } },
      ];
    case "duration":
      return [
        {
          $group: Object.fromEntries([
            ["_id", null],
            ...Object.entries(DURATION_BUCKETS).map(([bucketKey, { min, max }]) => [
              bucketKey,
              {
                $sum: {
                  $cond: [
                    Number.isFinite(max)
                      ? { $and: [{ $gte: ["$stats.totalDurationSec", min] }, { $lt: ["$stats.totalDurationSec", max] }] }
                      : { $gte: ["$stats.totalDurationSec", min] },
                    1,
                    0,
                  ],
                },
              },
            ]),
          ]),
        },
      ];
    case "topic":
      return [{ $unwind: "$topics" }, { $group: { _id: "$topics", count: { $sum: 1 } } }];
    case "level":
      return [
        { $addFields: { _levelOption: { $cond: [{ $in: ["$level", ["all", "advanced"]] }, "all", "$level"] } } },
        { $group: { _id: "$_levelOption", count: { $sum: 1 } } },
      ];
    case "subs":
      return [
        { $unwind: "$stats.captionLanguages" },
        { $group: { _id: "$stats.captionLanguages", count: { $sum: 1 } } },
      ];
    case "price":
      return [
        {
          $group: {
            _id: null,
            free: { $sum: { $cond: [{ $eq: ["$price", 0] }, 1, 0] } },
            paid: { $sum: { $cond: [{ $gt: ["$price", 0] }, 1, 0] } },
          },
        },
      ];
    default:
      return [];
  }
}

const RATING_GROUP_KEY_TO_OPTION = { r45: "4.5", r40: "4.0", r35: "3.5", r30: "3.0" };

function formatFacetResult(key, rows) {
  if (key === "cert") return rows[0]?.count ?? 0;
  if (key === "rating") {
    const { _id, ...counts } = rows[0] ?? {};
    return Object.fromEntries(Object.entries(counts).map(([k, v]) => [RATING_GROUP_KEY_TO_OPTION[k] ?? k, v]));
  }
  if (key === "duration" || key === "price") {
    const { _id, ...counts } = rows[0] ?? {};
    return counts;
  }
  // lang / practice / topic / level / subs: one row per value.
  return Object.fromEntries(rows.filter((r) => r._id != null).map((r) => [r._id, r.count]));
}

const ITEM_PROJECTION = {
  _id: 1,
  title: 1,
  subtitle: 1,
  description: 1,
  thumbnail: 1,
  price: 1,
  currency: 1,
  category: 1,
  categoryLabel: 1,
  subcategory: 1,
  topics: 1,
  level: 1,
  language: 1,
  isCertificationPrep: 1,
  learningObjectives: 1,
  stats: 1,
  publishedAt: 1,
  updatedAt: 1,
  authorId: 1,
  authorName: 1,
  authorUsername: 1,
};

/**
 * Runs the whole search in one aggregation: text match + every active
 * filter, plus a disjunctive `$facet` for counts, plus the (unscored, not
 * yet paginated) candidate set capped at CANDIDATE_CAP.
 *
 * Returns `{ candidates, total, facets, relaxed }` — candidates are plain
 * objects (author name/label already resolved), ready for relevance.js to
 * score and index.js to paginate + map to CourseCardDTO.
 */
export async function findCandidates({ q, filters }) {
  const { strict, relaxed } = buildTextMatch(q);

  const basePipeline = [
    { $lookup: { from: "users", localField: "author", foreignField: "_id", as: "_author" } },
    { $unwind: { path: "$_author", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        authorId: "$_author._id",
        authorName: { $ifNull: ["$_author.name", ""] },
        authorUsername: "$_author.username",
        categoryLabel: { $switch: CATEGORY_LABEL_SWITCH },
      },
    },
  ];

  const run = async (textMatch) => {
    const facetStages = Object.fromEntries(
      FILTER_KEYS.map((key) => [key, [matchStage(textMatch, filters, key), ...facetGroupPipeline(key)]])
    );
    const [result] = await Courses.aggregate([
      ...basePipeline,
      {
        $facet: {
          ...facetStages,
          total: [matchStage(textMatch, filters, null), { $count: "count" }],
          items: [matchStage(textMatch, filters, null), { $limit: CANDIDATE_CAP }, { $project: ITEM_PROJECTION }],
        },
      },
    ]);
    return result;
  };

  let relaxedFlag = false;
  let result = strict ? await run(strict) : await run(null);

  if (strict && (result.items?.length ?? 0) === 0) {
    result = await run(relaxed);
    relaxedFlag = true;
  }

  const facets = Object.fromEntries(FILTER_KEYS.map((key) => [key, formatFacetResult(key, result[key] ?? [])]));

  return {
    candidates: result.items ?? [],
    total: result.total?.[0]?.count ?? 0,
    facets,
    relaxed: relaxedFlag,
  };
}
