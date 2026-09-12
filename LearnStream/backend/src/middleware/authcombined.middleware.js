
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { UserTeacher } from "../models/user/userteachermodel.js";
import { UserStudent } from "../models/user/userstudentmodel.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";

const verifyJWTCombined = asyncHandler(async (req, res, next) => {
    const teacherToken = req.cookies?.teacherAccessToken || req.header("Authorization")?.replace(/^Bearer\s?/, "").trim();
    const studentToken = req.cookies?.studentAccessToken || req.header("Authorization")?.replace(/^Bearer\s?/, "").trim();

    let isAuthorized = false;

    // Check teacher
    if (teacherToken) {
        try {
            const decoded = jwt.verify(teacherToken, env.accessToken.secret);
            const teacher = await UserTeacher.findById(decoded._id).select("-password -refreshToken");
            if (teacher) {
                req.teacher = teacher;
                isAuthorized = true;
            }
        } catch (err) {
            // Teacher token might be invalid — continue to student
        }
    }

    // Check student
    if (!isAuthorized && studentToken) {
        try {
            const decoded = jwt.verify(studentToken, env.accessToken.secret);
            const student = await UserStudent.findById(decoded._id).select("-password -refreshToken");
            if (student) {
                req.student = student;
                isAuthorized = true;
            }
        } catch (err) {
            // Student token might be invalid
        }
    }

    if (!isAuthorized) {
        throw new ApiError(401, "Unauthorized - Token invalid or missing for both student and teacher.");
    }

    next();
});

export { verifyJWTCombined };
