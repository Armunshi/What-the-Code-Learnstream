import { Router } from "express"
import { getCurrentUser, loginUser, logoutUser, registerUser } from "../controllers/UserAuth/auth.controller.js";
import { requireRole, verifyAuth } from "../middleware/auth.js";
import { ROLES } from "../models/user.model.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.route('/me').get(verifyAuth, requireRole(ROLES.STUDENT), getCurrentUser)
router.route('/signup').post(authLimiter, registerUser(ROLES.STUDENT))
router.route('/login').post(authLimiter, loginUser(ROLES.STUDENT))
router.route('/logout').post(logoutUser(ROLES.STUDENT))

export default router
