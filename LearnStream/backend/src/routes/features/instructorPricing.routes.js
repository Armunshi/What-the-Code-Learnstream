import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { verifyAuth, requireRole } from "../../middleware/auth.js";
import * as courseService from "../../services/instructor/course.service.js";

// Its own file, same reasoning as instructorLearners.routes.js (whose own
// comment names this exact pattern as the template CURR/LAND/PRICING's own
// PATCH endpoints should copy): the editVersion optimistic-lock pattern
// (docs/contracts/domain-model.md D2/D3, api-conventions.md "Concurrency").
const router = Router();
router.use(verifyAuth, requireRole("teacher"));

router.patch(
    "/:courseId/pricing",
    asyncHandler(async (req, res) => {
        const result = await courseService.updateCoursePricing(req.params.courseId, req.user._id, req.body);
        if (result.conflict) {
            // Frozen shape (api-conventions.md "Error shapes"), same as the
            // learners endpoint: a stale editVersion returns the current
            // document, not a bare error.
            return res.status(409).json({ code: "VERSION_CONFLICT", current: result.current });
        }
        return res.status(200).json(new ApiResponse(200, { course: result.course }, "Pricing updated"));
    })
);

export default { basePath: "/instructor/courses", priority: 50, router };
