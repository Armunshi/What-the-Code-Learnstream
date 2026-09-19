import mongoose, { Schema } from "mongoose";
import { SEARCH_EVENT_TTL_DAYS } from "../config/search.js";

// Raw query log (§6.4 "Query log"). One document per POST
// /courses/search/events call — the client-observed outcome of one search
// (q, how many results it got, and an anonymous session), not a user
// identity: no user id field exists here on purpose (§6.4's privacy note —
// "no user id is stored"), so this collection can't be used to reconstruct
// what any particular person searched for.
//
// This is the source trending.js and related.js's co-occurrence step read
// from directly (aggregated at query time, not pre-rolled into
// searchQuery.model.js) — see that file's own comment for why the two
// models split this way.
const searchEventSchema = new Schema(
  {
    // Anonymous uuid, rotated client-side after 30 min idle (plan §2.7) —
    // never a user id.
    sessionId: { type: String, required: true },
    q: { type: String, required: true, trim: true, maxlength: 200 },
    resultCount: { type: Number, required: true, min: 0 },
    at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

// Trending's own window scan and related.js's per-session co-occurrence
// lookup are both "for this session, what else was searched near this time".
searchEventSchema.index({ sessionId: 1, at: 1 });
// Trending's own aggregation scans recent events grouped by query.
searchEventSchema.index({ at: -1, q: 1 });
// 90-day TTL (§6.4) — a query log entry is scratch state for ranking
// features, not a durable record.
searchEventSchema.index({ at: 1 }, { expireAfterSeconds: SEARCH_EVENT_TTL_DAYS * 24 * 60 * 60 });

export const SearchEvent = mongoose.model("SearchEvent", searchEventSchema);
