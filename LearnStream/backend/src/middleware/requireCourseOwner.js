import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Assignments } from "../models/assignment.model.js";
import { Courses } from "../models/course.model.js";
import { Lectures } from "../models/lecture.model.js";
import { Modules } from "../models/module.model.js";

// Route params are spelled inconsistently across the route table
// (:course_id and :courseId both exist, likewise :lecture_id/:lectureId),
// so accept either rather than making the guard's correctness depend on
// which spelling a given route happened to use.
const param = (req, ...names) => {
    for (const name of names) {
        const value = req.params[name];
        if (value) return value;
    }
    return undefined;
};

// Walks UP from the resource the route actually addresses to the course that
// owns it — lecture → module → course — instead of reading a course id out of
// the URL.
//
// This is the whole point of the guard. Handlers used to assert ownership of
// the course named in the route param and then mutate a lecture or assignment
// named in a *different* param, with nothing checking the two were related. A
// teacher who owned any course could pass their own course_id alongside
// another teacher's lecture_id and delete that lecture, and its Cloudinary
// asset, with it. Resolving upward makes the id being authorized and the id
// being modified the same object by construction; there is no param left to
// disagree with. It is the same lesson as §1.2, where the fix was to resolve
// an assignment's real course via its module rather than trust `courseId`.
const resolvers = {
    async course(req) {
        const courseId = param(req, "course_id", "courseId");
        if (!courseId) throw new ApiError(400, "Course id is required");
        const course = await Courses.findById(courseId);
        if (!course) throw new ApiError(404, "Course not found");
        return { course };
    },

    async module(req) {
        const moduleId = param(req, "module_id", "moduleId");
        if (!moduleId) throw new ApiError(400, "Module id is required");
        const module = await Modules.findById(moduleId);
        if (!module) throw new ApiError(404, "Module not found");
        const course = await Courses.findById(module.course);
        if (!course) throw new ApiError(404, "Course not found");
        return { module, course };
    },

    async lecture(req) {
        const lectureId = param(req, "lecture_id", "lectureId");
        if (!lectureId) throw new ApiError(400, "Lecture id is required");
        const lecture = await Lectures.findById(lectureId);
        if (!lecture) throw new ApiError(404, "Lecture not found");
        const module = await Modules.findById(lecture.module_id);
        if (!module) throw new ApiError(404, "Module not found");
        const course = await Courses.findById(module.course);
        if (!course) throw new ApiError(404, "Course not found");
        return { lecture, module, course };
    },

    async assignment(req) {
        const assignmentId = param(req, "assignment_id", "assignmentId");
        if (!assignmentId) throw new ApiError(400, "Assignment id is required");
        const assignment = await Assignments.findById(assignmentId);
        if (!assignment) throw new ApiError(404, "Assignment not found");
        const module = await Modules.findById(assignment.module_id);
        if (!module) throw new ApiError(404, "Module not found");
        const course = await Courses.findById(module.course);
        if (!course) throw new ApiError(404, "Course not found");
        return { assignment, module, course };
    },
};

/**
 * Route guard: the caller must be the teacher who owns the course that owns
 * `from` (one of "course", "module", "lecture", "assignment").
 *
 * Composed at the route so authorization is visible in the route table and
 * cannot be forgotten inside a handler body — it was missing from at least
 * four handlers that needed it (BACKEND_AUDIT.md §5.3). Must run after
 * verifyJWT, which is what sets req.teacher.
 *
 * Everything it resolved is attached to the request (req.course, req.module,
 * req.lecture, req.assignment) so the handler does not re-query, and — more
 * importantly — so the handler works from the objects that were actually
 * authorized rather than re-deriving them from route params.
 */
export const requireCourseOwner = (from) => {
    const resolve = resolvers[from];
    if (!resolve) {
        // Thrown at import time, not on the first request, so a typo in a
        // route definition fails the boot rather than a production call.
        throw new Error(
            `requireCourseOwner: unknown resource "${from}" — expected one of ${Object.keys(resolvers).join(", ")}`
        );
    }

    return asyncHandler(async (req, res, next) => {
        if (!req.teacher?._id) {
            throw new ApiError(401, "Teacher authentication is required");
        }

        const resolved = await resolve(req);

        if (resolved.course.author.toString() !== req.teacher._id.toString()) {
            throw new ApiError(403, "You are not authorized to modify this course");
        }

        Object.assign(req, resolved);
        next();
    });
};
