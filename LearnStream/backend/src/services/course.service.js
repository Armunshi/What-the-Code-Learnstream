import { z } from "zod";
import { ApiError } from "../utils/ApiError.js";
import { Courses } from "../models/course.model.js";
import { Progress } from "../models/progress.model.js";
import { CurriculumItems } from "../models/curriculumItem.model.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "./media.service.js";
import { MEDIA_STATUS } from "../models/schemas/media.schema.js";
// The NEW, provider-switchable upload path (respects MEDIA_PROVIDER=fake for
// tests/e2e — see services/media/index.js), used only for the promo video
// below. The thumbnail keeps using the legacy media.service.js import above
// unchanged, so existing thumbnail-upload behavior doesn't shift as a side
// effect of adding promo-video support.
import { uploadOnCloudinary as uploadPromoVideo, mediaProvider } from "./media/index.js";
import { COURSE_STATUS, canTransition } from "../config/courseLifecycle.js";

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

export const createCourse = async (
    teacherId,
    { title, description, price, category, isLive, thumbnailLocalPath, promoVideoLocalPath }
) => {
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

    // Optional at creation time — most authoring flows will add this later
    // through the (not-yet-built) instructor upload pipeline (D4, UPL).
    // Accepting it here too lets a course be created already carrying a
    // playable promo video in one step, which is what CAT's own e2e catalog
    // seed needs (a guest-visible landing page with a real trailer) ahead of
    // that pipeline landing.
    let promoVideo;
    if (promoVideoLocalPath) {
        const uploaded = await uploadPromoVideo(promoVideoLocalPath);
        if (uploaded?.secure_url) {
            promoVideo = {
                provider: mediaProvider.name,
                publicId: uploaded.public_id,
                status: MEDIA_STATUS.READY,
                statusChangedAt: new Date(),
                durationSec: uploaded.duration ?? 0,
                mp4Url: uploaded.secure_url,
                posterUrl: thumbnail.secure_url,
            };
        }
    }

    const course = await Courses.create({
        thumbnail: thumbnail.secure_url,
        title,
        description,
        price: priceInPaise,
        author: teacherId,
        category,
        isLive,
        ...(promoVideo ? { promoVideo } : {}),
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
 * DRAFT <-> PUBLISHED transition (D2). No dedicated authoring "publish" flow
 * exists yet (that's W1-SHELL's readiness/publish step, a sibling Wave 1
 * lane not available in this worktree) — this is the minimal endpoint that
 * lets the owning teacher flip a course's status at all, reusing
 * courseLifecycle.js's own `canTransition` guard rather than inventing a
 * parallel rule. It's also what makes CAT's own e2e catalog seed (and any
 * guest-facing manual check) possible: a freshly created course starts
 * DRAFT, and only a PUBLISHED course is visible to a guest at all (D2).
 * SHELL can layer readiness checks on top of this later; the transition
 * rule itself doesn't change.
 */
export const updateCourseStatus = async (course, nextStatus) => {
    if (!canTransition(course.status, nextStatus)) {
        throw new ApiError(400, `Cannot transition a course from ${course.status} to ${nextStatus}`);
    }

    course.status = nextStatus;
    if (nextStatus === COURSE_STATUS.PUBLISHED && !course.publishedAt) {
        course.publishedAt = new Date();
    }
    await course.save();
    return course;
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

    const course = await Courses.findById(courseId).select("_id");
    if (!course) {
        throw new ApiError(404, "Encountered an error while fetching course details");
    }

    // CurriculumItems is the source of truth for totals now, not
    // course.lectures/course.assignments — the latter's assignment count was
    // always 0 (nothing ever pushed to it; assignments only ever linked to
    // their module, BACKEND_AUDIT.md §3.13), which silently made every
    // course's progress look 100% assignment-complete before a single
    // assignment existed. Percent is computed over "countable" item types
    // only (video, article, quiz, assignment) — resource items never count
    // toward completion, matching the D5 rule for Progress v2's
    // percentComplete applied here to this legacy response shape.
    const [totalLectures, totalAssignments] = await Promise.all([
        CurriculumItems.countDocuments({ course: courseId, type: "video" }),
        CurriculumItems.countDocuments({ course: courseId, type: "assignment" }),
    ]);
    // article/quiz item types will count here too once an authoring UI
    // creates them — there is no such source yet, so they're always 0.
    const totalCountable = totalLectures + totalAssignments;
    const completedCountable = progress.completedLectures.length + progress.completedAssignments.length;

    return {
        progressPercentage: totalCountable > 0 ? (completedCountable / totalCountable) * 100 : 0,
        completedLecturesCount: progress.completedLectures.length,
        completedAssignmentsCount: progress.completedAssignments.length,
        totalLectures,
        totalAssignments,
    };
};
