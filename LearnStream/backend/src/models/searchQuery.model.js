import mongoose, { Schema } from "mongoose";

// Per-query aggregate (§6.4 "searchqueries: per-query aggregates"). Unlike
// SearchEvent (one row per search, TTL'd), this is one row per NORMALIZED
// query string, upserted on every POST /courses/search/events call — it's
// what related.js's step 2 ("prefix and token overlap") scans, since doing
// that against the raw, unbounded event log on every /related request would
// mean re-scanning history each time. Trending itself intentionally does NOT
// read this collection (see trending.js) — it needs an exact 7-day window
// with a distinct-session count, which requires the raw per-session-per-time
// SearchEvent rows this collection has already lost by aggregating.
const searchQuerySchema = new Schema(
  {
    // Normalized (lowercased, trimmed, whitespace-collapsed) — the lookup
    // key. Two different-cased searches for "React" and "react" upsert the
    // same document.
    q: { type: String, required: true, unique: true },
    // Most recent as-typed casing, for display (trending/related lists show
    // this, not the normalized key).
    displayQ: { type: String, required: true },
    searchCount: { type: Number, default: 0 },
    lastResultCount: { type: Number, default: 0 },
    lastSearchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// related.js's prefix/token-overlap scan is popularity-ranked.
searchQuerySchema.index({ searchCount: -1 });

export const SearchQuery = mongoose.model("SearchQuery", searchQuerySchema);
