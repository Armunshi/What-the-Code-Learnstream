import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as courseService from "../../services/course.service.js";

const createCourse = asyncHandler(async (req, res) => {
    const { title, description, price, category, isLive } = req.body;

    if (!title || !description || !price || !category) {
        throw new ApiError(400, "Basic info about the course required");
    }

    const thumbnailLocalPath = req.file?.path;
    if (!thumbnailLocalPath) {
        throw new ApiError(400, "thumbnail file is required");
    }

    const course = await courseService.createCourse(req.user._id, {
        title,
        description,
        price,
        category,
        isLive,
        thumbnailLocalPath,
    });

    return res.status(200).json(new ApiResponse(200, course, "created course succesfully"));
});

const getCourseByStudentId = asyncHandler(async (req, res) => {
    const courses = await courseService.getCoursesForStudent(req.user._id);

    return res.status(200).json(new ApiResponse(200, courses, "student courses succesfully sent "));
});

const getCourseByTeacherId = asyncHandler(async (req, res) => {
    const courses = await courseService.getCoursesForTeacher(req.user._id);

    return res.status(200).json(new ApiResponse(200, courses, "teachercourses succesfully sent "));
});

const getCourseById = asyncHandler(async (req, res) => {
    const course = await courseService.getCourseById(req.params.courseId);

    return res.status(200).json(new ApiResponse(200, course, "course sent succesfully"));
});

const getCoursesByCategory = asyncHandler(async (req, res) => {
    const { category } = req.query;

    if (!category) throw new ApiError(400, "Category is required");

    const courses = await courseService.getCoursesByCategory(category);

    return res.status(200).json(new ApiResponse(200, courses, "Courses fetched successfully"));
});

const getAllCourses = asyncHandler(async (req, res) => {
    const courses = await courseService.getAllCourses();

    return res.status(200).json(new ApiResponse(200, courses, "Courses Fetched Succesfully"));
});

const checkEnrollment = asyncHandler(async (req, res) => {
    const enrolled = await courseService.isStudentEnrolled(req.user._id, req.params.courseId);

    return res.status(200).json(new ApiResponse(200, enrolled, "Student Already enrolled"));
});

const getEnrolledStudents = asyncHandler(async (req, res) => {
    // Resolved and authorized by requireCourseOwner('course'). Only the three
    // fields the previous `.select()` returned are sent, so the response shape
    // is unchanged — the guard hands over the whole document.
    const { _id, author, enrolledStudents } = req.course;

    return res.status(200).json(
        new ApiResponse(200, { _id, author, enrolledStudents }, "Succesfully Sent Student Data")
    );
});

const CourseProgress = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    if (!courseId) {
        throw new ApiError(400, "The course sent doesn't exist or is undefined");
    }

    // req.student doesn't exist any more — the B5.6 user-model unification
    // replaced it with req.user, set by verifyAuth. This one survived the
    // mechanical rename because `req?.student?._id` (optional chaining on
    // `req` itself) doesn't match the literal substring `req.student` that
    // the rename script searched for. Left as `undefined`, Progress.findOne
    // silently dropped the key and matched by courseId alone — returning
    // any student's progress for that course, or none, never THIS student's.
    const progress = await courseService.getCourseProgress({
        studentId: req.user._id,
        courseId,
    });

    return progress === null
        ? res.status(200).json(new ApiResponse(200, 0, "No progress found, returning 0%"))
        : res.status(200).json(new ApiResponse(200, progress, "Progress data sent successfully"));
});

const getCourseOwner = asyncHandler(async (req, res) => {
    const { courseId } = req.params;

    if (!courseId) throw new ApiError(400, "courseId not found");

    const owner = await courseService.getCourseOwner(courseId);

    return res.status(200).json(new ApiResponse(200, owner, "Owner fetched successfully"));
});

export {
    createCourse,
    getCoursesByCategory,
    getAllCourses,
    getCourseById,
    getCourseByStudentId,
    CourseProgress,
    getEnrolledStudents,
    checkEnrollment,
    getCourseByTeacherId,
    getCourseOwner
}
