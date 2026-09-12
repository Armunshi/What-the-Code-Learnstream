import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler.js";
import { UserStudent } from "../models/user/userstudentmodel.js";
import { UserTeacher } from "../models/user/userteachermodel.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import { generateAccessAndRefreshTokens as generateTeacherTokens } from "../controllers/UserAuth/UserTeacher.controller.js";
import { generateAccessAndRefreshTokens as generateStudentTokens } from "../controllers/UserAuth/UserStudent.controller.js";


const refreshAccessToken = asyncHandler(async (req, res) => {
    let incomingRefreshToken = req.cookies?.studentRefreshToken;
    let role = "student";

    if (!incomingRefreshToken && req.cookies?.teacherRefreshToken) {
        incomingRefreshToken = req.cookies.teacherRefreshToken;
        role = "teacher";
    }

    if (!incomingRefreshToken) {
        throw new ApiError(401, "No refresh token provided");
    }

    let decodedToken;
    try {
        decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }

    if (!decodedToken?._id) {
        throw new ApiError(401, "Invalid refresh token");
    }

    // Check both collections
    let user = await UserStudent.findById(decodedToken._id);

    if (!user) {
        user = await UserTeacher.findById(decodedToken._id);
        role = "teacher";
    }

    if (!user) {
        throw new ApiError(401, "User not found");
    }

    if (user.refreshToken !== incomingRefreshToken) {
        throw new ApiError(401, "Refresh token mismatch");
    }
    let tokens;

    if (role === "student") {
        tokens = await generateStudentTokens(user._id);
    } else {
        tokens = await generateTeacherTokens(user._id);
    }

    // generateStudentTokens/generateTeacherTokens already set `refreshToken`
    // on the user and save it — a second save here would write from this
    // stale, pre-refresh snapshot and can clobber concurrent field updates.
    const { accessToken, refreshToken: newRefreshToken } = tokens;

    const options = {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 24 * 60 * 60 * 1000, // 1 day
    };

    // Set cookies based on role
    return res
        .status(200)
        .cookie(`${role}AccessToken`, accessToken, options)
        .cookie(`${role}RefreshToken`, newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                { accessToken, refreshToken: newRefreshToken, role },
                "Access token refreshed"
            )
        );
});

const router  = Router();
router.route('/refresh-Token').post(refreshAccessToken);

 export default router;