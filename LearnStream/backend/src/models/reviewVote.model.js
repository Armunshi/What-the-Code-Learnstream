import mongoose, { Schema } from "mongoose";

// D7: HELPFUL | UNHELPFUL | NONE. The endpoint SETS this state — the client
// computes the toggle transition (FR-REV-3.2), the server just persists
// whatever is sent. NONE is a real, storable state (not "delete the row")
// so the unique (review, user) index below can stay a plain upsert target
// instead of the write path needing an insert-or-delete branch.
export const VOTE_STATUS = Object.freeze({
    HELPFUL: "HELPFUL",
    UNHELPFUL: "UNHELPFUL",
    NONE: "NONE",
});
export const VOTE_STATUS_VALUES = Object.values(VOTE_STATUS);

const reviewVoteSchema = new Schema(
    {
        review: {
            type: Schema.Types.ObjectId,
            ref: "Review",
            required: true,
        },
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        status: {
            type: String,
            enum: VOTE_STATUS_VALUES,
            required: true,
            default: VOTE_STATUS.NONE,
        },
    },
    { timestamps: true }
);

// One vote row per (review, user) — a later vote overwrites the prior one
// via upsert rather than accumulating rows, which is what makes
// countDocuments({review, status}) always reflect current, non-duplicated
// voter counts (D7).
reviewVoteSchema.index({ review: 1, user: 1 }, { unique: true });

export const ReviewVote = mongoose.model("ReviewVote", reviewVoteSchema);
