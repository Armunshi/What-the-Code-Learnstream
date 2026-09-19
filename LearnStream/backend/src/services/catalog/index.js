import { Courses } from "../../models/course.model.js";
import { User } from "../../models/user.model.js";
import { COURSE_STATUS } from "../../config/courseLifecycle.js";
import { toCourseCardDTO } from "../../utils/dto/courseCard.js";
import { toCoursePublicDTO } from "../../utils/dto/coursePublic.js";
import { getViewerAccess } from "../entitlement.service.js";
import { ApiError } from "../../utils/ApiError.js";

const MAX_LIMIT = 48;
const DEFAULT_LIMIT = 24;

// Sort keys accepted by GET /courses/catalog (plan §4 W1-CAT). "popular" is
// the default — enrollment count is the closest signal this dataset has to
// Udemy's own default ordering.
const SORTS = {
    popular: { "stats.enrollmentCount": -1 },
    newest: { publishedAt: -1 },
    rating: { "stats.ratingAvg": -1 },
    "price-low": { price: 1 },
    "price-high": { price: -1 },
};

const paginationParams = ({ page, limit } = {}) => ({
    page: Math.max(1, Number.isFinite(+page) ? Math.trunc(+page) : 1),
    limit: Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(+limit) ? Math.trunc(+limit) : DEFAULT_LIMIT)),
});

/**
 * Ids of every course that qualifies as a "bestseller" (docs/contracts/dto.md
 * badge rule 1: top 3 by stats.enrollmentCount within its category, and at
 * least 5 enrollments). This is a fact about the whole category, not just
 * whatever page is currently being rendered — see courseCard.js's own doc
 * comment on why the caller has to supply this rather than the DTO mapper
 * re-querying siblings per card — so it always scans every PUBLISHED course,
 * independent of the current catalog query's filters/pagination.
 */
const getBestsellerIds = async () => {
    const groups = await Courses.aggregate([
        { $match: { status: COURSE_STATUS.PUBLISHED, "stats.enrollmentCount": { $gte: 5 } } },
        { $sort: { "stats.enrollmentCount": -1 } },
        { $group: { _id: "$category", ids: { $push: "$_id" } } },
    ]);

    const ids = new Set();
    for (const group of groups) {
        for (const id of group.ids.slice(0, 3)) ids.add(String(id));
    }
    return ids;
};

/** GET /courses/catalog — CourseCardDTO[] + pagination (plan §4 W1-CAT). */
export const getCatalog = async ({ category, subcategory, sort, page, limit }) => {
    const { page: p, limit: l } = paginationParams({ page, limit });

    const filter = { status: COURSE_STATUS.PUBLISHED };
    if (category) filter.category = category;
    if (subcategory) filter.subcategory = subcategory;

    const sortSpec = SORTS[sort] ?? SORTS.popular;

    const [courses, total, bestsellerIds] = await Promise.all([
        Courses.find(filter)
            .sort(sortSpec)
            .skip((p - 1) * l)
            .limit(l)
            .populate("author", "name username"),
        Courses.countDocuments(filter),
        getBestsellerIds(),
    ]);

    const items = courses.map((course) =>
        toCourseCardDTO(course, { isBestseller: bestsellerIds.has(String(course._id)) })
    );

    return { items, total, page: p, limit: l };
};

/**
 * Aggregate instructor stats for the CoursePublicDTO's `instructor` block
 * (courseCount/totalStudents/avgRating — docs/contracts/dto.md). Computed
 * over the instructor's PUBLISHED courses only, same visibility rule as
 * everywhere else a course is counted (D2).
 */
const getInstructorSummary = async (authorId) => {
    const [author, agg] = await Promise.all([
        User.findById(authorId).select("name username avatar headline bio"),
        Courses.aggregate([
            { $match: { author: authorId, status: COURSE_STATUS.PUBLISHED } },
            {
                $group: {
                    _id: "$author",
                    courseCount: { $sum: 1 },
                    totalStudents: { $sum: "$stats.enrollmentCount" },
                    avgRating: { $avg: "$stats.ratingAvg" },
                },
            },
        ]),
    ]);

    const stats = agg[0] ?? { courseCount: 0, totalStudents: 0, avgRating: 0 };

    return {
        _id: author?._id,
        name: author?.name,
        username: author?.username,
        avatar: author?.avatar,
        headline: author?.headline,
        bio: author?.bio,
        courseCount: stats.courseCount,
        totalStudents: stats.totalStudents,
        avgRating: Math.round((stats.avgRating ?? 0) * 10) / 10,
    };
};

/**
 * GET /courses/:courseId/landing — CoursePublicDTO (docs/contracts/dto.md).
 * A draft is visible only to an entitled viewer (owner or enrolled student),
 * same rule as the curriculum endpoint (courses-curriculum.routes.js) —
 * enrolled students keep access to a course's own pages even after the owner
 * unpublishes it (D2).
 */
export const getCourseLanding = async (courseId, viewer) => {
    const course = await Courses.findById(courseId);
    if (!course) throw new ApiError(404, "Course not found");

    const { isEntitled } = getViewerAccess(viewer, course);
    if (course.status !== COURSE_STATUS.PUBLISHED && !isEntitled) {
        throw new ApiError(404, "Course not found");
    }

    const instructor = await getInstructorSummary(course.author);
    const dto = toCoursePublicDTO(course, instructor);

    // toCoursePublicDTO (utils/dto/coursePublic.js, frozen since W0-B) never
    // included price/currency — an oversight in the frozen DTO shape, not a
    // deliberate omission like enrolledStudents on CourseCardDTO (that one's
    // dropped on purpose, see courseCard.js). CourseDetailPage's PreviewCard
    // needs a price to render at all (plan's W1-CAT task list: "Sticky
    // PreviewCard: ... price, <PurchaseCta/>"), and COM's own PurchaseCta
    // state machine (stubs.md) keys off "Free course" vs "Paid course",
    // which also needs this. Filed as a needed dto.md/coursePublic.js
    // amendment (see this lane's final report) — added here, in a file this
    // lane owns, rather than editing the frozen DTO utility itself.
    return { ...dto, price: course.price ?? 0, currency: course.currency ?? "INR" };
};
