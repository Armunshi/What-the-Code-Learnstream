import { ApiError } from "./ApiError.js";

// Throws if `course` doesn't exist or doesn't belong to `teacherId`.
// Used to guard module/lecture/assignment mutation so one teacher can't
// edit or delete another teacher's course content.
const assertCourseOwnership = (course, teacherId) => {
    if (!course) {
        throw new ApiError(404, "Course not found");
    }
    if (course.author.toString() !== teacherId.toString()) {
        throw new ApiError(403, "You are not authorized to modify this course");
    }
};

export { assertCourseOwnership };
