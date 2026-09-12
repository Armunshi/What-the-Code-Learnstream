import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as moduleService from "../../services/module.service.js";
import * as bulkModuleService from "../../services/bulk-module.service.js";

// Every handler here is: read the request, call a service, format a response.
// req.course / req.module were resolved AND authorized by the route's
// requireCourseOwner guard, so nothing below re-fetches or re-checks them.

const addModule = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if (!title) {
        throw new ApiError(400, "Module title is required");
    }

    const module = await moduleService.createModule(req.course, { title, description });

    return res.status(200).json(new ApiResponse(200, module, "Module added successfully"));
});

const updateModule = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    const module = await moduleService.updateModuleDetails(req.module, { title, description });

    return res.status(200).json(new ApiResponse(200, module, "Module updated successfully"));
});

const deleteModule = asyncHandler(async (req, res) => {
    await moduleService.deleteModuleWithContent(req.course, req.module);

    return res.status(200).json(new ApiResponse(200, null, "Module deleted successfully"));
});

const getCourseModules = asyncHandler(async (req, res) => {
    const { course_id } = req.params;

    // Deliberately not behind requireEnrollment: B1 chose to let non-entitled
    // callers browse titles and durations with public_id stripped, so the
    // entitlement check is a response-shaping decision made here rather than a
    // gate at the route.
    const course = await moduleService.getCourseWithModules(course_id);

    const isOwner = req.user?.role === "teacher" && course.author.toString() === req.user._id.toString();
    const isEnrolled = req.user?.role === "student" && course.enrolledStudents.some(
        (studentId) => studentId.toString() === req.user._id.toString()
    );

    const modules = isOwner || isEnrolled
        ? course.modules
        : moduleService.stripMediaIds(course.modules);

    return res.status(200).json(new ApiResponse(200, modules, "Modules fetched successfully"));
});

const getModuleById = asyncHandler(async (req, res) => {
    const { module_id } = req.params;

    const module = await moduleService.getModuleWithContent(module_id);

    return res.status(200).json(new ApiResponse(200, module, "Module retrieved successfully"));
});

// Creates any number of modules, each with any number of lectures and
// assignments, as one all-or-nothing request — BACKEND_AUDIT.md §3.20.
// Replaces the old flow of one module, then its lectures, then its
// assignments, as N separate awaited requests behind a single Submit click,
// which a closed tab could interrupt partway through with no way to tell
// which parts had actually been sent.
const addModulesBulk = asyncHandler(async (req, res) => {
    let modulesSpec;
    try {
        modulesSpec = JSON.parse(req.body.structure ?? "");
    } catch {
        throw new ApiError(400, "structure must be valid JSON");
    }

    const course = await bulkModuleService.createModulesBulk(req.course, modulesSpec, req.files ?? []);

    return res.status(200).json(new ApiResponse(200, course, "Modules created successfully"));
});

export {
    getCourseModules,
    addModule,
    addModulesBulk,
    deleteModule,
    updateModule,
    getModuleById
}
