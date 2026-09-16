// Query normalization + regex helpers shared by engine.mongo.js (matching)
// and relevance.js (scoring) — kept separate from both so there is exactly
// one place that knows how a query becomes tokens and how a token becomes a
// regex, which is also the one place a "regex input is escaped" test
// (plan §W1-SRC backend tests) needs to exercise.

/** Escapes every regex metacharacter — the one thing standing between a
 * user's search box and a ReDoS/broken-query bug via `.`, `(`, `*`, etc. */
export function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** "  React   Hooks! " -> "react hooks" */
export function normalizeQuery(q) {
  return String(q ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Splits a normalized query into non-empty word tokens. */
export function tokenize(q) {
  return normalizeQuery(q)
    .split(/[^a-z0-9+#.]+/i)
    .map((t) => t.trim())
    .filter(Boolean);
}

/** Escaped, case-insensitive, word-prefix regex for one token (D6): matches
 * `token` at the start of a word anywhere in the field, e.g. "rea" matches
 * "React" and "Great React" but not "korean". */
export function wordPrefixRegExp(token) {
  return new RegExp(`\\b${escapeRegex(token)}`, "i");
}

/** Mongo query fragment: `field` (string or array-of-strings) contains a
 * word-prefix match for `token`. */
export function wordPrefixMatch(field, token) {
  return { [field]: wordPrefixRegExp(token) };
}
