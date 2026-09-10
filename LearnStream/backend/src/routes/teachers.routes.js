import {Router} from "express"
import {loginUser, logoutUser, registerUser, getCurrentTeacher} from "../controllers/UserAuth/UserTeacher.controller.js"
import { verifyJWT } from "../middleware/authteacher.middleware.js";
const router =Router();

router.route('/me').get(verifyJWT, getCurrentTeacher)

router.route('/signup').post(
    // injecting middle ware
    // upload.fields([
    //     {
    //         name:"avatar", // front end field should also be avatar
    //         maxCount: 1
    //     },
    //     {
    //         name:"coverImage",
    //         maxCount: 1
    //     }
    // ]),
    registerUser)
router.route('/login').post(loginUser)
// secured route
router.route('/logout').post(logoutUser)
export default router