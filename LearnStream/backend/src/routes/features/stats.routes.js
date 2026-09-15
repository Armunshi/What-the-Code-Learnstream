import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { publicCache } from "../../middleware/cacheControl.js";
import { getPlatformStats } from "../../services/reviews/platformStats.js";

// docs/lanes/rev.json owns this file. A new /stats prefix, so there's no
// legacy route to collide with here (same reasoning as
// users-summary.routes.js's /users prefix).
const router = Router();

router.get(
    "/platform",
    publicCache(300, 900),
    asyncHandler(async (req, res) => {
        const stats = await getPlatformStats();
        return res.status(200).json(new ApiResponse(200, stats, "Platform stats fetched successfully"));
    })
);

export default { basePath: "/stats", priority: 100, router };
