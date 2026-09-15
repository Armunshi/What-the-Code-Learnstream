import { Review } from "../../models/review.model.js";
import { ReviewVote, VOTE_STATUS } from "../../models/reviewVote.model.js";
import { Courses } from "../../models/course.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { getViewerAccess } from "../entitlement.service.js";
import { recomputeRatingStats, toRatingDistributionPercentages } from "./ratingStats.js";
import { recountReviewVotes } from "./voteStats.js";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 48;

const idsMatch = (a, b) => Boolean(a) && Boolean(b) && a.toString() === b.toString();

const toReviewDTO = (review, voteStatus, viewerId) => ({
    id: review._id.toString(),
    user: {
        id: review.user._id.toString(),
        name: review.user.name,
        avatar: review.user.avatar ?? null,
    },
    rating: review.rating,
    comment: review.comment,
    createdAt: review.createdAt,
    helpfulCount: review.helpfulCount,
    unhelpfulCount: review.unhelpfulCount,
    userVoteStatus: voteStatus ?? VOTE_STATUS.NONE,
    isMine: idsMatch(review.user._id, viewerId),
});

const loadCourseOr404 = async (courseId) => {
    const course = await Courses.findById(courseId);
    if (!course) throw new ApiError(404, "Course not found");
    return course;
};

/**
 * GET /courses/:courseId/reviews (dto.md "Reviews"). `viewer` is `req.user`
 * or undefined for a guest — optionalAuth, so userVoteStatus/isMine are only
 * ever non-default for an authenticated caller.
 */
export const listReviews = async ({ courseId, page = 1, limit = DEFAULT_LIMIT, sort = "recent", viewer }) => {
    await loadCourseOr404(courseId);

    const safeLimit = Math.min(MAX_LIMIT, Math.max(1, Number(limit) || DEFAULT_LIMIT));
    const safePage = Math.max(1, Number(page) || 1);
    const sortSpec = sort === "helpful" ? { helpfulCount: -1, createdAt: -1 } : { createdAt: -1 };

    const [reviews, total] = await Promise.all([
        Review.find({ course: courseId })
            .populate("user", "name avatar")
            .sort(sortSpec)
            .skip((safePage - 1) * safeLimit)
            .limit(safeLimit),
        Review.countDocuments({ course: courseId }),
    ]);

    let votesByReview = new Map();
    if (viewer?._id && reviews.length > 0) {
        const votes = await ReviewVote.find({
            review: { $in: reviews.map((r) => r._id) },
            user: viewer._id,
        }).select("review status");
        votesByReview = new Map(votes.map((v) => [v.review.toString(), v.status]));
    }

    const items = reviews.map((review) =>
        toReviewDTO(review, votesByReview.get(review._id.toString()), viewer?._id)
    );

    return { items, total, page: safePage, limit: safeLimit };
};

/** GET /courses/:courseId/rating-summary (dto.md). */
export const getRatingSummary = async (courseId) => {
    const course = await loadCourseOr404(courseId);
    const { ratingAvg, ratingCount, enrollmentCount } = course.stats ?? {};
    const distribution = course.stats?.ratingDistribution?.toObject
        ? course.stats.ratingDistribution.toObject()
        : course.stats?.ratingDistribution ?? {};

    return {
        averageRating: ratingAvg ?? 0,
        totalRatingsCount: ratingCount ?? 0,
        totalStudentsEnrolled: enrollmentCount ?? 0,
        ratingDistribution: toRatingDistributionPercentages(distribution),
    };
};

const assertCanReview = (course, viewer) => {
    const { isEnrolled, isOwner } = getViewerAccess(viewer, course);
    if (isOwner) {
        throw new ApiError(403, "Course owners cannot review their own course");
    }
    if (!isEnrolled) {
        throw new ApiError(403, "You must be enrolled in this course to review it");
    }
};

/** POST /courses/:courseId/reviews — enrolled students only (D7, plan W1-REV). */
export const createReview = async (courseId, viewer, { rating, comment }) => {
    const course = await loadCourseOr404(courseId);
    assertCanReview(course, viewer);

    try {
        await Review.create({ course: courseId, user: viewer._id, rating, comment: comment ?? "" });
    } catch (error) {
        if (error?.code === 11000) {
            throw new ApiError(409, "You have already reviewed this course");
        }
        throw error;
    }

    await recomputeRatingStats(courseId);
    return getMyReview(courseId, viewer);
};

const findMyReviewOr404 = async (courseId, viewer) => {
    const review = await Review.findOne({ course: courseId, user: viewer._id }).populate("user", "name avatar");
    if (!review) {
        throw new ApiError(404, "You have not reviewed this course");
    }
    return review;
};

export const getMyReview = async (courseId, viewer) => {
    const review = await findMyReviewOr404(courseId, viewer);
    return toReviewDTO(review, undefined, viewer._id);
};

/** PATCH /courses/:courseId/reviews/mine */
export const updateReview = async (courseId, viewer, { rating, comment }) => {
    const review = await findMyReviewOr404(courseId, viewer);
    if (rating !== undefined) review.rating = rating;
    if (comment !== undefined) review.comment = comment;
    await review.save();

    await recomputeRatingStats(courseId);
    return toReviewDTO(review, undefined, viewer._id);
};

/** DELETE /courses/:courseId/reviews/mine */
export const deleteReview = async (courseId, viewer) => {
    const review = await findMyReviewOr404(courseId, viewer);
    await Promise.all([
        Review.deleteOne({ _id: review._id }),
        // Votes on a review that no longer exists have nothing left to
        // count towards — dropped here rather than left orphaned.
        ReviewVote.deleteMany({ review: review._id }),
    ]);

    await recomputeRatingStats(courseId);
};

/**
 * PUT /reviews/:reviewId/vote {status}. The endpoint SETS state — the
 * client already decided the toggle transition (D7/FR-REV-3.2). Voting on
 * your own review is rejected (D7).
 */
export const castVote = async (reviewId, viewer, status) => {
    const review = await Review.findById(reviewId);
    if (!review) {
        throw new ApiError(404, "Review not found");
    }
    if (idsMatch(review.user, viewer._id)) {
        throw new ApiError(403, "You cannot vote on your own review");
    }

    await ReviewVote.findOneAndUpdate(
        { review: reviewId, user: viewer._id },
        { $set: { status } },
        { upsert: true, setDefaultsOnInsert: true }
    );

    const counts = await recountReviewVotes(reviewId);
    return { ...counts, userVoteStatus: status };
};

/** GET /reviews/featured — homepage TestimonialCarousel (HomeSocialProof). */
export const getFeaturedReviews = async (limit = 10) => {
    const reviews = await Review.find({ rating: { $gte: 4 } })
        .populate("user", "name avatar")
        .populate("course", "title")
        .sort({ helpfulCount: -1, createdAt: -1 })
        .limit(limit);

    return reviews
        .filter((review) => review.course) // drop reviews whose course was hard-deleted, if that ever happens
        .map((review) => ({
            id: review._id.toString(),
            rating: review.rating,
            comment: review.comment,
            createdAt: review.createdAt,
            user: {
                id: review.user._id.toString(),
                name: review.user.name,
                avatar: review.user.avatar ?? null,
            },
            course: { id: review.course._id.toString(), title: review.course.title },
        }));
};
