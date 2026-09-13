import { Router } from "express"
import { getCurrentUser, loginUser, logoutUser, registerUser } from "../controllers/UserAuth/auth.controller.js";
import { requireRole, verifyAuth } from "../middleware/auth.js";
import { ROLES } from "../models/user.model.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.route('/me').get(verifyAuth, requireRole(ROLES.TEACHER), getCurrentUser)
router.route('/signup').post(authLimiter, registerUser(ROLES.TEACHER))
router.route('/login').post(authLimiter, loginUser(ROLES.TEACHER))
router.route('/logout').post(logoutUser(ROLES.TEACHER))

export default router
