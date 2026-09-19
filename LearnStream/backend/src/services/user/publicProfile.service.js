import { User } from "../../models/user.model.js";
import { Courses } from "../../models/course.model.js";
import { COURSE_STATUS } from "../../config/courseLifecycle.js";
import { toCourseCardDTOs } from "../../utils/dto/courseCard.js";
import { ApiError } from "../../utils/ApiError.js";

// Deliberately narrow: never exposes email, phone, wishlist, or a student's
// enrolled-course ids to a public viewer (the same "full roster is a privacy
// leak" reasoning dto.md gives for CourseCardDTO dropping enrolledStudents)
// — a public profile is not the same document as GET /users/me. A teacher's
// own authored, published courses are the one exception (below), the same
// thing their course pages already show as "more from this instructor", and
// only when privacy.showCourses isn't explicitly off.
const PUBLIC_SELECT = "firstName lastName name username headline bio links language avatar emailVerifiedAt role privacy";
const MAX_PUBLIC_COURSES = 12;

export const getPublicProfile = async (username) => {
    const user = await User.findOne({ username }).select(PUBLIC_SELECT).lean();
    if (!user) throw new ApiError(404, "User not found");

    let courses = null;
    if (user.role === "teacher" && user.privacy?.showCourses !== false) {
        const authored = await Courses.find({ author: user._id, status: COURSE_STATUS.PUBLISHED })
            .sort({ publishedAt: -1 })
            .limit(MAX_PUBLIC_COURSES)
            .populate("author", "name username")
            .lean();
        courses = toCourseCardDTOs(authored);
    }

    return {
        id: String(user._id),
        firstName: user.firstName ?? null,
        lastName: user.lastName ?? null,
        name: user.name,
        username: user.username,
        headline: user.headline ?? null,
        bio: user.bio ?? null,
        links: user.links ?? [],
        language: user.language ?? null,
        avatar: user.avatar ?? null,
        role: user.role,
        verified: Boolean(user.emailVerifiedAt),
        courses,
    };
};
