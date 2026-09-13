import { Router } from "express";
import { refreshAccessToken } from "../controllers/UserAuth/auth.controller.js";

const router = Router();

router.route('/refresh-Token').post(refreshAccessToken);

export default router;
