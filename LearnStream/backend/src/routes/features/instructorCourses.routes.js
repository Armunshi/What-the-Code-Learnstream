import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { verifyAuth, requireRole } from "../../middleware/auth.js";
import * as courseService from "../../services/instructor/course.service.js";

// The authoring shell's course-level endpoints (plan W1-SHELL): list/create,
// fetch/delete one, and the publish lifecycle. Every route here requires a
// logged-in teacher — ownership of a specific course is then checked inside
// the service (getOwnedCourse), so a non-owner gets 403, not just "any
// teacher can see any course".
const router = Router();
router.use(verifyAuth, requireRole("teacher"));

router.get(
    "/",
    asyncHandler(async (req, res) => {
        const courses = await courseService.listCoursesForTeacher(req.user._id);
        return res.status(200).json(new ApiResponse(200, { items: courses }, "Courses fetched"));
    })
);

router.post(
    "/",
    asyncHandler(async (req, res) => {
        const course = await courseService.createDraftCourse({ authorId: req.user._id, title: req.body?.title });
        return res.status(201).json(new ApiResponse(201, { course }, "Draft course created"));
    })
);

router.get(
    "/:courseId",
    asyncHandler(async (req, res) => {
        const course = await courseService.getOwnedCourse(req.params.courseId, req.user._id);
        return res.status(200).json(new ApiResponse(200, { course }, "Course fetched"));
    })
);

router.delete(
    "/:courseId",
    asyncHandler(async (req, res) => {
        await courseService.deleteDraftCourse(req.params.courseId, req.user._id);
        return res.status(200).json(new ApiResponse(200, null, "Course deleted"));
    })
);

router.post(
    "/:courseId/publish",
    asyncHandler(async (req, res) => {
        const result = await courseService.publishCourse(req.params.courseId, req.user._id);
        if (result.notReady) {
            // Not one of api-conventions.md's frozen error shapes — no other
            // lane defines a publish-blocked response yet — so this picks the
            // closest existing convention (message + code) and adds `required`
            // so steps/review's checklist can render fix links straight from
            // the response instead of a second GET …/readiness round trip.
            return res.status(422).json({
                message: "This course isn't ready to publish yet",
                code: "NOT_READY",
                required: result.failing,
            });
        }
        return res.status(200).json(new ApiResponse(200, { course: result.course }, "Course published"));
    })
);

router.post(
    "/:courseId/unpublish",
    asyncHandler(async (req, res) => {
        const course = await courseService.unpublishCourse(req.params.courseId, req.user._id);
        return res.status(200).json(new ApiResponse(200, { course }, "Course unpublished"));
    })
);

export default { basePath: "/instructor/courses", priority: 50, router };
