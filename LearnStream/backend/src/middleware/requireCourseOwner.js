import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { resolverFor } from "./courseContext.js";

/**
 * Route guard: the caller must be the teacher who owns the course that owns
 * `from` (one of "course", "module", "lecture", "assignment").
 *
 * Composed at the route so authorization is visible in the route table and
 * cannot be forgotten inside a handler body — it was missing from at least
 * four handlers that needed it (BACKEND_AUDIT.md §5.3). Must run after
 * verifyAuth, which is what sets req.user.
 *
 * Everything it resolved is attached to the request (req.course, req.module,
 * req.lecture, req.assignment) so the handler does not re-query and — more
 * importantly — works from the objects that were actually authorized rather
 * than re-deriving them from route params.
 */
export const requireCourseOwner = (from) => {
    const resolve = resolverFor("requireCourseOwner", from);

    return asyncHandler(async (req, res, next) => {
        if (req.user?.role !== "teacher") {
            throw new ApiError(403, "This action requires the teacher role");
        }

        const resolved = await resolve(req);

        if (resolved.course.author.toString() !== req.user._id.toString()) {
            throw new ApiError(403, "You are not authorized to modify this course");
        }

        Object.assign(req, resolved);
        next();
    });
};
