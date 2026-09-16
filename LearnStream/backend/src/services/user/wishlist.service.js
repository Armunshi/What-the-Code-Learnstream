import { User } from "../../models/user.model.js";
import { Courses } from "../../models/course.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { toCourseCardDTOs } from "../../utils/dto/courseCard.js";

export const getWishlist = async (userId) => {
    const user = await User.findById(userId).select("wishlist").lean();
    const courseIds = user?.wishlist ?? [];
    if (courseIds.length === 0) return [];

    // CourseCardDTO (docs/contracts/dto.md, frozen) needs `author` populated
    // with at least {_id, name, username} — the same shape every other
    // course-card listing in the codebase already populates.
    const courses = await Courses.find({ _id: { $in: courseIds } })
        .populate("author", "name username")
        .lean();
    return toCourseCardDTOs(courses);
};

export const addToWishlist = async (userId, courseId) => {
    const course = await Courses.findById(courseId).select("_id");
    if (!course) throw new ApiError(404, "Course not found");

    await User.findByIdAndUpdate(userId, { $addToSet: { wishlist: courseId } });
    return getWishlist(userId);
};

export const removeFromWishlist = async (userId, courseId) => {
    await User.findByIdAndUpdate(userId, { $pull: { wishlist: courseId } });
    return getWishlist(userId);
};
