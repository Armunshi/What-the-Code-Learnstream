import { ApiError } from "../utils/ApiError.js";
import { Assignments } from "../models/assignment.model.js";
import { Courses } from "../models/course.model.js";
import { Lectures } from "../models/lecture.model.js";
import { Modules } from "../models/module.model.js";

// Route params are spelled inconsistently across the route table
// (:course_id and :courseId both exist, likewise :lecture_id/:lectureId), so
// accept either rather than making a guard's correctness depend on which
// spelling a given route happened to use.
const param = (req, ...names) => {
    for (const name of names) {
        const value = req.params[name];
        if (value) return value;
    }
    return undefined;
};

// Each resolver walks UP from the resource the route actually addresses to the
// course that owns it — lecture → module → course — instead of reading a
// course id out of the URL.
//
// That direction is the point. Handlers used to authorize the course named in
// one URL segment and then act on a lecture or assignment named in a different
// segment, with nothing checking the two were related. Resolving upward makes
// the id being authorized and the id being acted on the same object by
// construction, so there is no second param left to disagree with. It is
// §1.2's lesson — resolve the real parent, never trust the route param.
export const courseResolvers = {
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

/** Picks a resolver, failing at import time rather than on the first request. */
export const resolverFor = (guardName, from) => {
    const resolve = courseResolvers[from];
    if (!resolve) {
        throw new Error(
            `${guardName}: unknown resource "${from}" — expected one of ${Object.keys(courseResolvers).join(", ")}`
        );
    }
    return resolve;
};
