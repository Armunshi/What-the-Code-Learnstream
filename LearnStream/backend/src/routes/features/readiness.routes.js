import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { verifyAuth, requireRole } from "../../middleware/auth.js";
import { getOwnedCourse } from "../../services/instructor/course.service.js";
import { computeReadiness } from "../../services/readiness/index.js";

const router = Router();
router.use(verifyAuth, requireRole("teacher"));

router.get(
    "/:courseId/readiness",
    asyncHandler(async (req, res) => {
        const course = await getOwnedCourse(req.params.courseId, req.user._id);
        const readiness = await computeReadiness(course);
        return res.status(200).json(new ApiResponse(200, readiness, "Readiness computed"));
    })
);

export default { basePath: "/instructor/courses", priority: 50, router };
