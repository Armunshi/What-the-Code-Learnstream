import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { verifyAuth, requireRole } from "../../middleware/auth.js";
import { getMyLearning } from "../../services/learn/myLearning.service.js";

// GET /users/me/learning (D5) — a second router mounted at the same
// `/users` basePath as users-summary.routes.js's `/me/summary`; different
// sub-path, so there's nothing to collide with.
const router = Router();

router.get(
    "/me/learning",
    verifyAuth,
    requireRole("student"),
    asyncHandler(async (req, res) => {
        const items = await getMyLearning(req.user._id);
        return res.status(200).json(new ApiResponse(200, { items }, "My learning fetched successfully"));
    })
);

export default { basePath: "/users", priority: 100, router };
