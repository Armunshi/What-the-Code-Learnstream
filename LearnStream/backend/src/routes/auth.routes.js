import { Router } from "express";
import { refreshAccessToken } from "../controllers/UserAuth/auth.controller.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.route('/refresh-Token').post(authLimiter, refreshAccessToken);

export default router;
