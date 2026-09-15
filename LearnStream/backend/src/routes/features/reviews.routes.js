import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { optionalAuth, verifyAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { validateQuery } from "../../middleware/validateQuery.js";
import { publicCache, cacheControl } from "../../middleware/cacheControl.js";
import {
    createReviewSchema,
    updateReviewSchema,
    voteSchema,
    reviewsQuerySchema,
} from "../../validation/review.schemas.js";
import {
    listReviews,
    getRatingSummary,
    createReview,
    updateReview,
    deleteReview,
    castVote,
    getFeaturedReviews,
} from "../../services/reviews/reviews.service.js";

// docs/lanes/rev.json owns this file. Mounted at basePath "/" (rather than
// "/courses" or "/reviews") because it carries both /courses/:courseId/...
// and /reviews/... paths in one router — every path here is multi-segment
// under its prefix, so it never collides with the legacy single-segment GET
// /courses/:courseId catch-all regardless of mount order (same reasoning as
// courses-curriculum.routes.js).
const router = Router();

router.get(
    "/courses/:courseId/reviews",
    optionalAuth,
    validateQuery(reviewsQuerySchema),
    // Vary: Authorization (dto.md) — the response is viewer-specific
    // (userVoteStatus/isMine) whenever a token is present, so a shared cache
    // must key on it rather than serving one viewer's personalization to
    // another.
    (req, res, next) => {
        res.set("Vary", "Authorization");
        next();
    },
    publicCache(30, 120),
    asyncHandler(async (req, res) => {
        const { courseId } = req.params;
        const { page, limit, sort } = req.query;
        const result = await listReviews({ courseId, page, limit, sort, viewer: req.user });
        return res.status(200).json(new ApiResponse(200, result, "Reviews fetched successfully"));
    })
);

router.get(
    "/courses/:courseId/rating-summary",
    publicCache(60, 300),
    asyncHandler(async (req, res) => {
        const summary = await getRatingSummary(req.params.courseId);
        return res.status(200).json(new ApiResponse(200, summary, "Rating summary fetched successfully"));
    })
);

router.post(
    "/courses/:courseId/reviews",
    verifyAuth,
    validate(createReviewSchema),
    asyncHandler(async (req, res) => {
        const review = await createReview(req.params.courseId, req.user, req.body);
        return res.status(201).json(new ApiResponse(201, review, "Review created successfully"));
    })
);

router.patch(
    "/courses/:courseId/reviews/mine",
    verifyAuth,
    validate(updateReviewSchema),
    asyncHandler(async (req, res) => {
        const review = await updateReview(req.params.courseId, req.user, req.body);
        return res.status(200).json(new ApiResponse(200, review, "Review updated successfully"));
    })
);

router.delete(
    "/courses/:courseId/reviews/mine",
    verifyAuth,
    asyncHandler(async (req, res) => {
        await deleteReview(req.params.courseId, req.user);
        return res.status(200).json(new ApiResponse(200, null, "Review deleted successfully"));
    })
);

router.put(
    "/reviews/:reviewId/vote",
    verifyAuth,
    validate(voteSchema),
    asyncHandler(async (req, res) => {
        const result = await castVote(req.params.reviewId, req.user, req.body.status);
        return res.status(200).json(new ApiResponse(200, result, "Vote recorded successfully"));
    })
);

router.get(
    "/reviews/featured",
    cacheControl({ maxAge: 300, staleWhileRevalidate: 600 }),
    asyncHandler(async (req, res) => {
        const items = await getFeaturedReviews();
        return res.status(200).json(new ApiResponse(200, { items }, "Featured reviews fetched successfully"));
    })
);

export default { basePath: "/", priority: 50, router };
