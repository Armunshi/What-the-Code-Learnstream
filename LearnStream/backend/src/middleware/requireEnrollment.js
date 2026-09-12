import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { resolverFor } from "./courseContext.js";

/**
 * Route guard: the caller must be entitled to this course's paid content —
 * either the teacher who owns it, or a student enrolled in it.
 *
 * §1.1 was a verified production incident: course content was reachable
 * without entitlement. B1 closed it on the modules endpoint by filtering
 * inside the handler, but the same content was still reachable through
 * sibling routes that nothing checked (BACKEND_AUDIT.md §3.7) — most
 * directly `getLectureById`, which returns the whole lecture document,
 * `videourl` and `public_id` included, to any authenticated caller.
 *
 * Deliberately NOT applied to the endpoints that return only titles and
 * durations. B1 chose to let non-entitled callers browse that metadata while
 * stripping `public_id`; gating it here would silently change what a course
 * preview shows. The line this guard draws is the same one B1 drew: the
 * secret is the Cloudinary id and the media URL, not the syllabus.
 *
 * Must run after an auth middleware that sets req.teacher or req.student.
 */
export const requireEnrollment = (from) => {
    const resolve = resolverFor("requireEnrollment", from);

    return asyncHandler(async (req, res, next) => {
        if (!req.teacher?._id && !req.student?._id) {
            throw new ApiError(401, "Authentication is required");
        }

        const resolved = await resolve(req);
        const { course } = resolved;

        const isOwner =
            req.teacher?._id && course.author.toString() === req.teacher._id.toString();

        const isEnrolled =
            req.student?._id &&
            course.enrolledStudents.some(
                (studentId) => studentId.toString() === req.student._id.toString()
            );

        if (!isOwner && !isEnrolled) {
            throw new ApiError(403, "You must be enrolled in this course to access its content");
        }

        Object.assign(req, resolved);
        next();
    });
};
