import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { User } from "../../models/user.model.js";
import { Cart } from "../../models/cart.model.js";
import { verifyAuth } from "../../middleware/auth.js";

// GET /users/me/summary (docs/contracts/dto.md) — backs the UserMenu label
// ("N courses enrolled") and cart badge without a separate query per widget.
// A new /users prefix, so there's no legacy route to collide with here.
const router = Router();

router.get(
    "/me/summary",
    verifyAuth,
    asyncHandler(async (req, res) => {
        const [user, cart] = await Promise.all([
            User.findById(req.user._id).select("Courses avatar role"),
            Cart.findOne({ user: req.user._id }).select("items"),
        ]);

        // `Courses` holds enrolled courses for a student and authored ones for
        // a teacher (user.model.js's long-standing dual meaning). This
        // endpoint's contract shape ({enrolledCount, enrolledCourseIds, ...})
        // is written for the student "N courses enrolled" widget; a teacher
        // viewer gets their authored count here, which is the same field but
        // not the same semantic — noted for whichever Wave 1 lane wires the
        // frontend widget, since it should probably only render this for
        // students.
        const courseIds = user?.Courses ?? [];

        const dto = {
            enrolledCount: courseIds.length,
            enrolledCourseIds: courseIds.map(String),
            cartCount: cart?.items?.length ?? 0,
            avatar: user?.avatar ?? null,
        };

        return res.status(200).json(new ApiResponse(200, dto, "Summary fetched successfully"));
    })
);

export default { basePath: "/users", priority: 100, router };
