import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { verifyAuth, requireRole } from "../../middleware/auth.js";
import * as courseService from "../../services/instructor/course.service.js";

// Its own file (rather than a route on instructorCourses.routes.js) because
// it's the one endpoint in this lane with the editVersion optimistic-lock
// pattern (docs/contracts/domain-model.md D2/D3, api-conventions.md
// "Concurrency") — kept separate so the guarded-write code path is easy to
// find and to reuse as the template CURR/LAND's own PATCH endpoints copy.
const router = Router();
router.use(verifyAuth, requireRole("teacher"));

router.patch(
    "/:courseId/learners",
    asyncHandler(async (req, res) => {
        const result = await courseService.updateLearners(req.params.courseId, req.user._id, req.body);
        if (result.conflict) {
            // Frozen shape (api-conventions.md "Error shapes"): a stale
            // editVersion returns the current document, not a bare error, so
            // the frontend's conflict dialog can offer "reload latest" without
            // a second GET.
            return res.status(409).json({ code: "VERSION_CONFLICT", current: result.current });
        }
        return res.status(200).json(new ApiResponse(200, { course: result.course }, "Learners info updated"));
    })
);

export default { basePath: "/instructor/courses", priority: 50, router };
