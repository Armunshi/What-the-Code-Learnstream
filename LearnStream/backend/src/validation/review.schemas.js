import { z } from "zod";
import { VOTE_STATUS_VALUES } from "../models/reviewVote.model.js";

// D7: rating is 1.0-5.0 in 0.5 steps. `Number.isInteger(v * 2)` is the exact
// check the contract specifies — a plain enum of the nine legal values would
// say the same thing more verbosely.
const ratingSchema = z
    .number()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5")
    .refine((v) => Number.isInteger(v * 2), "Rating must be in 0.5 steps (e.g. 4, 4.5, 5)");

const commentSchema = z.string().trim().max(2000, "Review comment must be at most 2000 characters");

export const createReviewSchema = z.object({
    rating: ratingSchema,
    comment: commentSchema.optional().default(""),
});

export const updateReviewSchema = z
    .object({
        rating: ratingSchema.optional(),
        comment: commentSchema.optional(),
    })
    .refine((data) => data.rating !== undefined || data.comment !== undefined, {
        message: "At least one of rating or comment must be provided",
    });

export const voteSchema = z.object({
    status: z.enum(VOTE_STATUS_VALUES, {
        error: `status must be one of ${VOTE_STATUS_VALUES.join(", ")}`,
    }),
});

export const reviewsQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(48).default(12),
    sort: z.enum(["recent", "helpful"]).default("recent"),
});
