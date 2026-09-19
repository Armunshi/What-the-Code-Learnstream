import { Courses } from "../../models/course.model.js";
import { User, ROLES } from "../../models/user.model.js";
import { COURSE_STATUS } from "../../config/courseLifecycle.js";

/**
 * GET /stats/platform — backs the homepage StatsStrip (HomeSocialProof).
 * Deliberately cheap: counts and one $avg aggregation, no per-course
 * fan-out. Cached at the route with a short public TTL (see
 * routes/features/stats.routes.js), and persisted client-side under the
 * 'stats' query key (frontend/src/lib/queryClient.js).
 */
export const getPlatformStats = async () => {
    const [studentCount, instructorCount, publishedCourseCount, ratingAgg] = await Promise.all([
        User.countDocuments({ role: ROLES.STUDENT }),
        User.countDocuments({ role: ROLES.TEACHER }),
        Courses.countDocuments({ status: COURSE_STATUS.PUBLISHED }),
        Courses.aggregate([
            { $match: { status: COURSE_STATUS.PUBLISHED, "stats.ratingCount": { $gt: 0 } } },
            { $group: { _id: null, avgRating: { $avg: "$stats.ratingAvg" } } },
        ]),
    ]);

    return {
        studentCount,
        instructorCount,
        courseCount: publishedCourseCount,
        averageRating: ratingAgg[0]?.avgRating ?? 0,
    };
};
