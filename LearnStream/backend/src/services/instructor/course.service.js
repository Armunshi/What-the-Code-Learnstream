import { z } from "zod";
import { ApiError } from "../../utils/ApiError.js";
import { Courses } from "../../models/course.model.js";
import { TAXONOMY } from "../../config/taxonomy.js";
import { COURSE_STATUS, canTransition } from "../../config/courseLifecycle.js";
import { computeReadiness } from "../readiness/index.js";

// course.model.js (D3, frozen after Wave 0) requires thumbnail/description/
// category/price even though C-FR-1's guided workflow only asks for a title
// up front — the rest is filled in later by the landing-page and pricing
// steps (LAND, Wave 2). These placeholders exist purely to satisfy that
// schema requirement at creation time; every readiness rule that actually
// cares whether a real thumbnail/description/price/category has been set
// belongs to the lane that owns that step (landing.rule.js, pricing.rule.js),
// not to SHELL.
const DRAFT_PLACEHOLDER_THUMBNAIL =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const DRAFT_PLACEHOLDER_DESCRIPTION = "Add a description to tell students what this course covers.";

const createDraftSchema = z.object({
    title: z.string().trim().min(1, "Title is required").max(60, "Title must be at most 60 characters"),
});

/**
 * D2's "Creating needs only a title, which makes a DRAFT" (plan W1-SHELL).
 * Per-author title uniqueness, not global (D3) — matches the existing legacy
 * course.service.js rule.
 */
export const createDraftCourse = async ({ authorId, title }) => {
    const parsed = createDraftSchema.safeParse({ title });
    if (!parsed.success) {
        const errors = parsed.error.issues.map((issue) => ({
            field: issue.path.join(".") || "title",
            code: issue.code,
        }));
        throw new ApiError(400, parsed.error.issues[0].message, errors);
    }

    if (await Courses.findOne({ title: parsed.data.title, author: authorId })) {
        throw new ApiError(400, "You already have a course with this title", [{ field: "title", code: "custom" }]);
    }

    return Courses.create({
        title: parsed.data.title,
        author: authorId,
        status: COURSE_STATUS.DRAFT,
        thumbnail: DRAFT_PLACEHOLDER_THUMBNAIL,
        description: DRAFT_PLACEHOLDER_DESCRIPTION,
        category: TAXONOMY[0].slug,
        price: 0,
    });
};

export const listCoursesForTeacher = (authorId) => Courses.find({ author: authorId }).sort({ updatedAt: -1 });

/**
 * Ownership resolution shared by every instructor endpoint: 404 when the
 * course doesn't exist at all, 403 when it exists but belongs to someone
 * else — so a non-owner always gets a plain "not yours", never a hint about
 * the course's internal state (readiness, version, …).
 */
export const getOwnedCourse = async (courseId, teacherId) => {
    const course = await Courses.findById(courseId);
    if (!course) {
        throw new ApiError(404, "Course not found");
    }
    if (String(course.author) !== String(teacherId)) {
        throw new ApiError(403, "You do not own this course");
    }
    return course;
};

/** Delete only for a DRAFT with no enrollments (plan W1-SHELL). */
export const deleteDraftCourse = async (courseId, teacherId) => {
    const course = await getOwnedCourse(courseId, teacherId);
    if (course.status !== COURSE_STATUS.DRAFT) {
        throw new ApiError(400, "Only a draft course can be deleted");
    }
    if (course.enrolledStudents.length > 0) {
        throw new ApiError(400, "Cannot delete a course with enrolled students");
    }
    await course.deleteOne();
};

const learnersInputSchema = z.object({
    editVersion: z.number().int().nonnegative(),
    learningObjectives: z.array(z.string().trim().min(1).max(160)).max(10).default([]),
    requirements: z.array(z.string().trim().min(1)).max(10).default([]),
    noPrerequisites: z.boolean().default(false),
    targetAudience: z.array(z.string().trim().min(1)).max(10).default([]),
});

/**
 * `PATCH /instructor/courses/:courseId/learners` (D2/D3, docs/contracts/
 * api-conventions.md "Concurrency"). The `findOneAndUpdate` filter carries
 * both `_id` and `editVersion` — a stale version simply matches no document,
 * which is how this tells "someone else saved first" apart from "the course
 * doesn't exist" without a separate read-then-write race window.
 */
export const updateLearners = async (courseId, teacherId, body) => {
    // Ownership is checked before the version guard, so a non-owner always
    // sees 403 rather than a version conflict about a course they can't
    // edit regardless of which editVersion they send.
    await getOwnedCourse(courseId, teacherId);

    const parsed = learnersInputSchema.safeParse(body);
    if (!parsed.success) {
        const errors = parsed.error.issues.map((issue) => ({
            field: issue.path.join(".") || "(body)",
            code: issue.code,
        }));
        throw new ApiError(400, parsed.error.issues[0].message, errors);
    }
    const { editVersion, learningObjectives, requirements, noPrerequisites, targetAudience } = parsed.data;

    const updated = await Courses.findOneAndUpdate(
        { _id: courseId, editVersion },
        { $set: { learningObjectives, requirements, noPrerequisites, targetAudience }, $inc: { editVersion: 1 } },
        { new: true, runValidators: true }
    );

    if (!updated) {
        const current = await Courses.findById(courseId);
        return { conflict: true, current };
    }
    return { conflict: false, course: updated };
};

/**
 * `POST …/publish` (C-FR-18): 422 with the failing required readiness rules
 * instead of publishing. Readiness is recomputed here rather than trusted
 * from a client-supplied readiness snapshot, since the registry it reads
 * from (readiness/rules/*.rule.js) grows as later lanes land their own
 * rules.
 */
export const publishCourse = async (courseId, teacherId) => {
    const course = await getOwnedCourse(courseId, teacherId);
    const readiness = await computeReadiness(course);
    const failing = readiness.required.filter((item) => !item.met);
    if (failing.length > 0) {
        return { notReady: true, failing };
    }

    if (!canTransition(course.status, COURSE_STATUS.PUBLISHED)) {
        throw new ApiError(400, `Cannot publish a course from status ${course.status}`);
    }

    course.status = COURSE_STATUS.PUBLISHED;
    course.publishedAt = new Date();
    course.editVersion += 1;
    await course.save();
    return { notReady: false, course };
};

export const unpublishCourse = async (courseId, teacherId) => {
    const course = await getOwnedCourse(courseId, teacherId);
    if (!canTransition(course.status, COURSE_STATUS.DRAFT)) {
        throw new ApiError(400, `Cannot unpublish a course from status ${course.status}`);
    }

    course.status = COURSE_STATUS.DRAFT;
    course.editVersion += 1;
    await course.save();
    return course;
};
