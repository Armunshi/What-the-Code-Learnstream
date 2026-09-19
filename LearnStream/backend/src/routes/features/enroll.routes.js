import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { requireRole, verifyAuth } from "../../middleware/auth.js";
import { ROLES } from "../../models/user.model.js";
import { Courses } from "../../models/course.model.js";
import { Cart } from "../../models/cart.model.js";
import { COURSE_STATUS } from "../../config/courseLifecycle.js";
import { enrollStudentInCourses } from "../../services/enrollment.service.js";

// POST /courses/:courseId/enroll — D10 free enrollment
// (docs/contracts/api-conventions.md): student only, the course must be
// PUBLISHED and price 0, idempotent (re-enrolling is a no-op success), and
// a paid course gets a plain 402 PAYMENT_REQUIRED rather than silently
// enrolling for free. Multi-segment path, so — like courses-curriculum.
// routes.js — it never collides with the legacy single-segment
// GET /courses/:courseId regardless of mount order.
const router = Router();

router.post(
    "/:courseId/enroll",
    verifyAuth,
    requireRole(ROLES.STUDENT),
    asyncHandler(async (req, res) => {
        const studentId = req.user._id;
        const { courseId } = req.params;

        const course = await Courses.findById(courseId).select("price status");
        if (!course || course.status !== COURSE_STATUS.PUBLISHED) {
            throw new ApiError(404, "Course not found");
        }
        if (course.price > 0) {
            return res.status(402).json({ code: "PAYMENT_REQUIRED" });
        }

        await enrollStudentInCourses(studentId, [courseId]);
        // Defensive cleanup only — addToCart already refuses a free course,
        // so this normally has nothing to pull. Guards the case where a
        // course was carted while still paid and then repriced to free.
        await Cart.findOneAndUpdate({ user: studentId }, { $pull: { items: { course: courseId } } });

        return res.status(200).json(new ApiResponse(200, { redirectTo: `/learn/${courseId}` }, "Enrolled"));
    })
);

export default { basePath: "/courses", priority: 50, router };
