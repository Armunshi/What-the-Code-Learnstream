import { Router } from "express"
import { getCurrentUser, loginUser, logoutUser, registerUser } from "../controllers/UserAuth/auth.controller.js";
import { requireRole, verifyAuth } from "../middleware/auth.js";
import { ROLES } from "../models/user.model.js";

const router = Router();

router.route('/me').get(verifyAuth, requireRole(ROLES.STUDENT), getCurrentUser)
router.route('/signup').post(registerUser(ROLES.STUDENT))
router.route('/login').post(loginUser(ROLES.STUDENT))
router.route('/logout').post(logoutUser(ROLES.STUDENT))

export default router
