import { z } from "zod";
import { ApiError } from "../utils/ApiError.js";
import { Courses } from "../models/course.model.js";
import { Progress } from "../models/progress.model.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "./media.service.js";
import { COURSE_STATUS } from "../config/courseLifecycle.js";

// Matches the schema's own limits (course.model.js: title maxlength 60) so a
// too-long title 400s in the frozen { message, errors: [{ field, code }] }
// shape (docs/contracts/api-conventions.md "Error shapes") instead of
// falling through to Mongoose's ValidationError, which errorHandler.middleware.js
// does turn into a 400 but not in this shape.
const courseInputSchema = z.object({
    title: z.string().trim().min(1, "Title is required").max(60, "Title must be at most 60 characters"),
    description: z.string().trim().min(1, "Description is required"),
    category: z.string().trim().min(1, "Category is required"),
});

const COURSE_CARD_FIELDS = "thumbnail title description price category author";

/**
 * D2's visibility rule (docs/contracts/domain-model.md): the public catalog,
 * search, and the course page show PUBLISHED courses only; the owning
 * teacher additionally sees their own drafts; an enrolled student keeps
 * access to a course even after the owner unpublishes it. Every place that
 * lists or fetches courses for anything other than an owning-teacher's own
 * authoring view should filter through this rather than querying `status`
 * directly, so the rule lives in one place.
 *
 * `viewer` is `req.user` (possibly undefined for a guest).
 */
export const visibleCourseFilter = (viewer) => {
    if (!viewer) {
        return { status: COURSE_STATUS.PUBLISHED };
    }
    if (viewer.role === "teacher") {
        return { $or: [{ status: COURSE_STATUS.PUBLISHED }, { author: viewer._id }] };
    }
    // A student viewer: published courses, plus anything they're enrolled in
    // — including one the owner has since unpublished.
    return { $or: [{ status: COURSE_STATUS.PUBLISHED }, { enrolledStudents: viewer._id }] };
};

export const createCourse = async (teacherId, { title, description, price, category, isLive, thumbnailLocalPath }) => {
    const parsed = courseInputSchema.safeParse({ title, description, category });
    if (!parsed.success) {
        const errors = parsed.error.issues.map((issue) => ({
            field: issue.path.join(".") || "(body)",
            code: issue.code,
        }));
        throw new ApiError(400, parsed.error.issues[0].message, errors);
    }
    ({ title, description, category } = parsed.data);

    // Price is integer paise end to end (BACKEND_AUDIT.md §2.7). It arrives as
    // a multipart string, so parse and range-check it here to turn a fractional
    // or non-numeric value into a clear 400 rather than a ValidationError.
    const priceInPaise = Number(price);
    if (!Number.isInteger(priceInPaise) || priceInPaise < 0) {
        throw new ApiError(400, "Price must be a whole number of paise (₹499 is sent as 49900)");
    }

    // Per-author, not global (D3): the same title is fine across two
    // different authors — global uniqueness was never the actual rule, just
    // an accident of the original `findOne({title})` check having no
    // `author` filter.
    if (await Courses.findOne({ title, author: teacherId })) {
        throw new ApiError(400, "You already have a course with this title", [{ field: "title", code: "custom" }]);
    }

    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    if (!thumbnail?.secure_url) {
        throw new ApiError(400, "thumbnail must be there");
    }

    const course = await Courses.create({
        thumbnail: thumbnail.secure_url,
        title,
        description,
        price: priceInPaise,
        author: teacherId,
        category,
        isLive,
    });

    const teacher = await User.findByIdAndUpdate(
        teacherId,
        { $push: { Courses: course._id } },
        { new: true }
    );
    if (!teacher) {
        throw new ApiError(400, "Error while adding reference to teacher");
    }

    return course;
};

export const getCoursesForStudent = async (studentId) => {
    const student = await User.findById(studentId, { Courses: 1 }).populate({
        path: "Courses",
        select: COURSE_CARD_FIELDS,
        populate: { path: "author", select: "name" },
    });

    if (!student) throw new ApiError(404, "student doesnt have any courses");
    return student;
};

export const getCoursesForTeacher = async (teacherId) => {
    const teacher = await User.findById(teacherId, { Courses: 1 }).populate({
        path: "Courses",
        select: COURSE_CARD_FIELDS,
        populate: { path: "author", select: "name" },
    });

    if (!teacher) throw new ApiError(404, "teacher doesnt have any courses");
    return teacher;
};

export const getCourseById = async (courseId) => {
    // enrolledStudents excluded: the full student roster is not something any
    // viewer of a course page needs, and handing it to "any viewer" (this
    // endpoint has no auth) is a privacy leak — see getEnrolledStudents
    // (Course.controller.js) for the actual, ownership-gated way to fetch it.
    const course = await Courses.findById(courseId).select("-enrolledStudents").populate("author", "name");
    if (!course) throw new ApiError(404, "course not found");
    return course;
};

// DEFAULT_PAGE_SIZE is deliberately larger than the current catalog (a
// couple dozen courses) so existing callers that don't pass page/limit see
// no behavioural change — this closes the "unbounded find()" gap
// (BACKEND_AUDIT.md §3.10) without requiring a frontend change to opt in.
const DEFAULT_PAGE_SIZE = 100;

const paginationParams = ({ page, limit } = {}) => ({
    page: Math.max(1, Number.isFinite(+page) ? Math.trunc(+page) : 1),
    limit: Math.min(200, Math.max(1, Number.isFinite(+limit) ? Math.trunc(+limit) : DEFAULT_PAGE_SIZE)),
});

export const getCoursesByCategory = async (category, pagination) => {
    const { page, limit } = paginationParams(pagination);

    // .populate('author', 'name') replaces a per-course User.findById in a
    // loop — the N+1 recorded as §3.9 — the same way getCourseById already
    // populates its single course.
    return Courses.find({ category })
        .select("thumbnail title author modules price")
        .populate("author", "name")
        .skip((page - 1) * limit)
        .limit(limit);
};

export const getAllCourses = async (pagination) => {
    const { page, limit } = paginationParams(pagination);

    return Courses.find()
        .select("thumbnail title description price category rating")
        .skip((page - 1) * limit)
        .limit(limit);
};

export const isStudentEnrolled = async (studentId, courseId) => {
    const student = await User.findById(studentId);
    if (!student) throw new ApiError(404, "student not found");

    const course = await Courses.findById(courseId);
    if (!course) throw new ApiError(404, "course id not found");

    return student.Courses.includes(courseId.toString());
};

export const getCourseOwner = async (courseId) => {
    const owner = await Courses.findById(courseId).select("author");
    if (!owner) throw new ApiError(404, "Course not found");
    return owner;
};

/**
 * A student's progress through one course.
 *
 * Returns null when no Progress document exists, so the caller can answer 0%
 * rather than 404 — a student who has not started is not an error.
 */
export const getCourseProgress = async ({ studentId, courseId }) => {
    const progress = await Progress.findOne({ courseId, studentId }).select(
        "completedLectures completedLectureCount completedAssignments"
    );
    if (!progress) return null;

    const course = await Courses.findById(courseId).select("lectures assignments");
    if (!course || (!course.lectures && !course.assignments)) {
        throw new ApiError(404, "Encountered an error while fetching course details");
    }

    const totalLectures = course.lectures?.length || 0;
    // NOTE: always 0 — nothing ever pushes to course.assignments; assignments
    // are only linked to their module. See BACKEND_AUDIT.md §3.13. Preserved
    // as-is here; fixing it changes reported progress and needs its own change.
    const totalAssignments = course.assignments?.length || 0;

    return {
        progressPercentage: totalLectures > 0 ? (progress.completedLectureCount / totalLectures) * 100 : 0,
        completedLecturesCount: progress.completedLectures.length,
        completedAssignmentsCount: progress.completedAssignments.length,
        totalLectures,
        totalAssignments,
    };
};
