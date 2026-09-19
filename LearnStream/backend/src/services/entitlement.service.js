import { COURSE_STATUS } from "../config/courseLifecycle.js";

// Shared "who is allowed to see/play what" logic. Both the module/lecture
// adapters (kept for backward compatibility) and the new curriculum/playback
// endpoints call into this, so entitlement rules exist in exactly one place
// rather than being re-derived per handler (which is how §1.1/§3.7's gaps
// happened in the first place — see requireEnrollment.js).

const idsMatch = (a, b) => Boolean(a) && Boolean(b) && a.toString() === b.toString();

/**
 * What `viewer` (a req.user, or undefined for a guest) may see/do on `course`.
 *
 * Returns `{ isOwner, isEnrolled, isEntitled }`. `isEntitled` is the OR of
 * the other two — the course owner previewing their own course and an
 * enrolled student both get full access, a guest or an unrelated
 * authenticated user get neither.
 */
export const getViewerAccess = (viewer, course) => {
    if (!viewer || !course) {
        return { isOwner: false, isEnrolled: false, isEntitled: false };
    }

    const isOwner = viewer.role === "teacher" && idsMatch(course.author, viewer._id);
    const isEnrolled =
        viewer.role === "student" &&
        Array.isArray(course.enrolledStudents) &&
        course.enrolledStudents.some((studentId) => idsMatch(studentId, viewer._id));

    return { isOwner, isEnrolled, isEntitled: isOwner || isEnrolled };
};

/**
 * Whether `viewer` may receive playable media for `item` in `course`.
 *
 * True for an entitled viewer (owner or enrolled student) regardless of
 * course status — the owner can always preview their own draft — or for ANY
 * viewer when the item is a free preview AND the course is PUBLISHED (a
 * free-preview item in an unpublished course is not publicly playable; the
 * owner still sees it via the entitlement branch above).
 */
export const canPlayItem = (viewer, course, item) => {
    const { isEntitled } = getViewerAccess(viewer, course);
    if (isEntitled) return true;

    return Boolean(item?.isFreePreview) && course?.status === COURSE_STATUS.PUBLISHED;
};
