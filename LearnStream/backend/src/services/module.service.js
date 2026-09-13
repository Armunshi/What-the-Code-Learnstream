import { ApiError } from "../utils/ApiError.js";
import { Assignments } from "../models/assignment.model.js";
import { Courses } from "../models/course.model.js";
import { Lectures } from "../models/lecture.model.js";
import { Modules } from "../models/module.model.js";
import { deleteMediaFromCloudinary } from "./media.service.js";

/** Creates a module under `course` and links it from the course. */
export const createModule = async (course, { title, description }) => {
    const module = await Modules.create({ title, description, course: course._id });

    course.modules.push(module._id);
    await course.save();

    return module;
};

export const updateModuleDetails = async (module, { title, description }) => {
    if (title) module.title = title;
    if (description) module.description = description;
    await module.save();
    return module;
};

/**
 * Deletes a module and everything under it — lecture and assignment documents,
 * their Cloudinary assets, and the ids the parent course still holds.
 *
 * This cascade is explicit and lives here rather than in a Mongoose
 * `pre('remove')` hook. The hooks that used to do it never fired at all under
 * Mongoose 8, which removed document `remove()` entirely, and silently left
 * orphaned lectures and dangling course ids behind for as long as they existed
 * (BACKEND_AUDIT.md §2.3, §6.3).
 */
export const deleteModuleWithContent = async (course, module) => {
    const populated = await module.populate(["lectures", "assignments"]);

    // allSettled, not all: one failed Cloudinary delete must not abandon the
    // rest of the cascade halfway and leave the database inconsistent (§2.5).
    const results = await Promise.allSettled([
        ...populated.lectures.map((lecture) =>
            deleteMediaFromCloudinary(lecture.public_id, lecture.resource_type)
        ),
        ...populated.assignments.flatMap((assignment) =>
            assignment.public_id.map((id, i) =>
                deleteMediaFromCloudinary(id, assignment.resourceTypes?.[i])
            )
        ),
    ]);
    results.forEach((result) => {
        if (result.status === "rejected") {
            console.error("Cloudinary cleanup failed during module delete:", result.reason);
        }
    });

    const lectureIds = populated.lectures.map((lecture) => lecture._id);
    const assignmentIds = populated.assignments.map((assignment) => assignment._id);

    await Lectures.deleteMany({ _id: { $in: lectureIds } });
    await Assignments.deleteMany({ _id: { $in: assignmentIds } });

    const lectureIdSet = new Set(lectureIds.map(String));
    const assignmentIdSet = new Set(assignmentIds.map(String));
    course.modules = course.modules.filter((id) => !id.equals(populated._id));
    course.lectures = course.lectures.filter((id) => !lectureIdSet.has(id.toString()));
    course.assignments = course.assignments.filter((id) => !assignmentIdSet.has(id.toString()));
    await course.save();

    await populated.deleteOne();
};

/** A course with its modules, and each module's lectures and assignments. */
export const getCourseWithModules = async (courseId) => {
    const course = await Courses.findById(courseId).populate({
        path: "modules",
        populate: [
            { path: "lectures", select: "title duration freePreview public_id " },
            { path: "assignments", select: "title deadline public_id " },
        ],
    });

    if (!course) throw new ApiError(404, "Course not found");
    return course;
};

/**
 * Drops `public_id` from every lecture and assignment.
 *
 * It is the only secret needed to build a direct, unauthenticated Cloudinary
 * URL, so callers who are neither the owning teacher nor an enrolled student
 * must not receive it. They still get titles and durations, which is what
 * makes a course preview useful (BACKEND_AUDIT.md §1.1).
 */
export const stripMediaIds = (modules) =>
    modules.map((module) => {
        const plain = module.toObject();
        plain.lectures = plain.lectures.map(({ public_id, ...rest }) => rest);
        plain.assignments = plain.assignments.map(({ public_id, ...rest }) => rest);
        return plain;
    });

export const getModuleWithContent = async (moduleId) => {
    const module = await Modules.findById(moduleId)
        .populate({ path: "lectures", select: "_id title duration freePreview" })
        .populate({ path: "assignments", select: "_id title deadline" });

    if (!module) throw new ApiError(404, "Module not found");
    return module;
};
