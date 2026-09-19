import { Review } from "../../models/review.model.js";
import { ReviewVote, VOTE_STATUS } from "../../models/reviewVote.model.js";

/**
 * Recomputes `review.helpfulCount`/`unhelpfulCount` from the ReviewVote rows
 * that currently exist for `reviewId`, via `countDocuments` — never
 * incremented/decremented in place (D7: "counts are recomputed ... never
 * incremented, so they can't drift"), so a lost update, a double-submit, or
 * a stale NONE row can never leave the counters out of sync with the actual
 * votes.
 */
export const recountReviewVotes = async (reviewId) => {
    const [helpfulCount, unhelpfulCount] = await Promise.all([
        ReviewVote.countDocuments({ review: reviewId, status: VOTE_STATUS.HELPFUL }),
        ReviewVote.countDocuments({ review: reviewId, status: VOTE_STATUS.UNHELPFUL }),
    ]);

    await Review.updateOne({ _id: reviewId }, { $set: { helpfulCount, unhelpfulCount } });

    return { helpfulCount, unhelpfulCount };
};
