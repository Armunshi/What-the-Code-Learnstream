// Search engine tuning knobs (D6, plan §6). Kept as one config module so the
// matching/relevance/facet code never hardcodes a magic number — a lane (or
// this one, later) can retune ranking or windowing here without touching the
// aggregation pipeline itself.

// Candidate ceiling per D6 ("about 1,000 candidates per query. Beyond that,
// move to Atlas"). Scoring/sorting happens in JS over at most this many
// documents, never the whole collection.
export const CANDIDATE_CAP = 1000;

// Relevance score weights (D6 §6.2 exactly).
export const SCORE = Object.freeze({
  TITLE_EXACT_PHRASE: 100,
  TITLE_PREFIX: 60,
  TITLE_WORD_PREFIX_PER_TOKEN: 20,
  SUBTITLE_MATCH: 10,
  TOPICS_MATCH: 10,
  CATEGORY_LABEL_MATCH: 8,
  AUTHOR_MATCH: 6,
  DESCRIPTION_MATCH: 2,
});

// Minimum-rating radio options (FR-SRC-3.2 group "rating"), most permissive
// last so `RATING_OPTIONS.find(...)` style lookups can rely on array order
// only when a caller wants that; nothing here currently depends on it.
export const RATING_OPTIONS = Object.freeze(['4.5', '4.0', '3.5', '3.0']);

// Video-duration radio buckets, in seconds (plan §6.3's own ranges). `max`
// is exclusive except for the open-ended last bucket.
export const DURATION_BUCKETS = Object.freeze({
  '0-1': { min: 0, max: 3600 },
  '1-3': { min: 3600, max: 10800 },
  '3-6': { min: 10800, max: 21600 },
  '6-17': { min: 21600, max: 61200 },
  '17+': { min: 61200, max: Infinity },
});
export const DURATION_BUCKET_KEYS = Object.freeze(Object.keys(DURATION_BUCKETS));

// Hands-on practice checkbox group. `quizzes`/`practice_tests` are live
// today (course.model.js stats.practiceTypes); `coding_exercises`/
// `role_plays` are reserved for a later content type and the plan says they
// stay hidden in the UI "at count 0" — the facet response still reports
// their (currently always-zero) count so the frontend can apply that rule
// without hardcoding which keys are reserved.
export const PRACTICE_TYPES = Object.freeze(['quizzes', 'practice_tests', 'coding_exercises', 'role_plays']);
export const RESERVED_PRACTICE_TYPES = Object.freeze(['coding_exercises', 'role_plays']);

// "beginner, intermediate, all (advanced)" (plan §6.3) — the filter UI
// exposes three checkboxes, and picking "all" matches BOTH of the model's
// 'all' and 'advanced' course.level values, since the plan folds the rare
// 'advanced' level into the same "All levels" checkbox rather than giving it
// a fourth option.
export const LEVEL_FILTER_OPTIONS = Object.freeze(['beginner', 'intermediate', 'all']);
export const levelFilterToModelLevels = (option) => (option === 'all' ? ['all', 'advanced'] : [option]);

export const PRICE_OPTIONS = Object.freeze(['free', 'paid']);

export const SORT_OPTIONS = Object.freeze(['relevant', 'highest_rated', 'most_reviewed', 'newest']);

// Trending (FR-SRC-4.1 fallback aside): top queries over this many days,
// needing at least this many distinct sessions and a non-zero result count.
export const TRENDING_WINDOW_DAYS = 7;
export const TRENDING_MIN_DISTINCT_SESSIONS = 3;
export const TRENDING_LIMIT = 8;

// Falls back to (and pads out to TRENDING_LIMIT with) these seeds when real
// query-log data doesn't yet clear the bar above — true for a fresh demo
// database. Never itself filtered by the denylist below; product picks these.
export const TRENDING_SEEDS = Object.freeze([
  'python for beginners',
  'react',
  'javascript',
  'web development',
  'data science',
  'machine learning',
  'aws certification',
  'ui/ux design',
]);

// Query-log privacy + relevance hygiene (§6.4, risk #20): queries that are
// empty of signal (nav-bar noise, single letters typed mid-search) never
// surface as "trending" or "related" even if they technically clear the
// session/result-count bar.
export const DENYLIST = Object.freeze(['test', 'asdf', 'a', 'the', '123', 'course', 'courses']);

export const RELATED_COOCCURRENCE_WINDOW_MIN = 30;
export const RELATED_LIMIT = 8;

export const FRESH_WINDOW_DAYS = 60;
export const FRESH_LIMIT = 12;

export const SUGGEST_MIN_CHARS = 1;
export const SUGGEST_MAX_CHARS = 60;
export const SUGGEST_KEYPHRASE_LIMIT = 5;
export const SUGGEST_COURSE_LIMIT = 3;
export const SUGGEST_INSTRUCTOR_LIMIT = 3;

// AI Overview spotlight (§6.4): shown only when the top result clears an
// absolute floor AND leads the runner-up by this margin, so a search with
// several near-equally-relevant courses never single one out arbitrarily.
export const SPOTLIGHT_MIN_SCORE = 80;
export const SPOTLIGHT_MIN_MARGIN = 30;

// Search-event log (searchEvent.model.js) TTL — a query log entry is
// scratch data for trending/related, never a durable record (§6.4 "Query
// log privacy": no user id, a TTL, zero-result queries excluded).
export const SEARCH_EVENT_TTL_DAYS = 90;

// POST /courses/search/events (D6 table: "rate-limited"). Keyed by
// sessionId + IP inside the route, not here — this is just the budget.
export const EVENTS_RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const EVENTS_RATE_LIMIT_MAX = 30;
