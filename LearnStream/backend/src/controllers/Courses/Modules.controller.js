import { Assignments } from "../../models/assignment.model.js";
import { Courses } from "../../models/course.model.js";
import { Lectures } from "../../models/lecture.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { deleteMediaFromCloudinary } from "../../utils/cloudinary.js";
import { Modules } from "../../models/module.model.js";

const addModule = asyncHandler(async (req, res) => {
    const { course_id } = req.params;
    const { title, description } = req.body;

    if (!course_id || !title) {
        throw new ApiError(400, "Course ID and Module title are required");
    }

    // req.course comes from requireCourseOwner('course') — already fetched and
    // already checked, so there is nothing to re-resolve or re-authorize here.
    const course = req.course;

    const newModule = await Modules.create({
        title,
        description,
        course: course._id
    });

    course.modules.push(newModule._id);
    await course.save();

    return res.status(200).json(new ApiResponse(200, newModule, "Module added successfully"));
});
const updateModule = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    // Resolved and authorized by requireCourseOwner('module').
    const module = req.module;

    if (title) module.title = title;
    if (description) module.description = description;

    await module.save();

    return res.status(200).json(
        new ApiResponse(200, module, "Module updated successfully")
    );
});

const deleteModule = asyncHandler(async (req, res) => {
    // Resolved and authorized by requireCourseOwner('module'); the guard does
    // not populate, and the cascade below needs the child documents.
    const course = req.course;
    const module = await req.module.populate(['lectures', 'assignments']);

    // Explicit cascade delete — the schema's `pre('remove')` hooks never
    // fired (Mongoose 8 removed document `remove()` entirely) and left
    // every lecture/assignment underneath orphaned, plus a dangling id in
    // the parent course's `modules[]` array (BACKEND_AUDIT.md §2.3).
    const cloudinaryDeletions = [
        ...module.lectures.map((lecture) =>
            deleteMediaFromCloudinary(lecture.public_id, lecture.resource_type)
        ),
        ...module.assignments.flatMap((assignment) =>
            assignment.public_id.map((id, i) =>
                deleteMediaFromCloudinary(id, assignment.resourceTypes?.[i])
            )
        ),
    ];
    const cloudinaryResults = await Promise.allSettled(cloudinaryDeletions);
    cloudinaryResults.forEach((result) => {
        if (result.status === "rejected") {
            console.error("Cloudinary cleanup failed during module delete:", result.reason);
        }
    });

    await Lectures.deleteMany({ _id: { $in: module.lectures.map((l) => l._id) } });
    await Assignments.deleteMany({ _id: { $in: module.assignments.map((a) => a._id) } });

    const lectureIds = new Set(module.lectures.map((l) => l._id.toString()));
    const assignmentIds = new Set(module.assignments.map((a) => a._id.toString()));
    course.modules = course.modules.filter((id) => !id.equals(module._id));
    course.lectures = course.lectures.filter((id) => !lectureIds.has(id.toString()));
    course.assignments = course.assignments.filter((id) => !assignmentIds.has(id.toString()));
    await course.save();

    await module.deleteOne();

    return res.status(200).json(
        new ApiResponse(200, null, "Module deleted successfully")
    );
});

const getCourseModules = asyncHandler(async (req, res) => {
    const { course_id } = req.params;

    const course = await Courses.findById(course_id).populate({
        path: 'modules',
        populate: [
            { path: 'lectures', select: 'title duration freePreview public_id ' },
            { path: 'assignments', select: 'title deadline public_id ' }
        ]
    });

    if (!course) {
        throw new ApiError(404, "Course not found");
    }

    const isOwner = req.teacher && course.author.toString() === req.teacher._id.toString();
    const isEnrolled = req.student && course.enrolledStudents.some(
        (studentId) => studentId.toString() === req.student._id.toString()
    );

    // Only the owning teacher or an enrolled student gets `public_id` — that's
    // the only secret needed to build a direct, unauthenticated Cloudinary
    // asset URL (see BACKEND_AUDIT.md §1.1). Everyone else gets titles/metadata only.
    let modules = course.modules;
    if (!isOwner && !isEnrolled) {
        modules = modules.map((module) => {
            const plain = module.toObject();
            plain.lectures = plain.lectures.map(({ public_id, ...rest }) => rest);
            plain.assignments = plain.assignments.map(({ public_id, ...rest }) => rest);
            return plain;
        });
    }

    return res.status(200).json(new ApiResponse(200, modules, "Modules fetched successfully"));
});
const getModuleById = asyncHandler(async (req, res) => {
    const { module_id } = req.params;

    const module = await Modules.findById(module_id)
        .populate({
            path: "lectures",
            select: "_id title duration freePreview",
        })
        .populate({
            path: "assignments",
            select: "_id title deadline",
        });

    if (!module) {
        throw new ApiError(404, "Module not found");
    }

    return res.status(200).json(
        new ApiResponse(200, module, "Module retrieved successfully")
    );
});

export{
    getCourseModules,
    addModule,
    deleteModule,
    updateModule,
    getModuleById
}