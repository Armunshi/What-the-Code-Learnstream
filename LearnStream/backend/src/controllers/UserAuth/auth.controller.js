import jwt from "jsonwebtoken";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { env } from "../../config/env.js";
import { ROLES, User } from "../../models/user.model.js";

// Replaces UserStudent.controller.js and UserTeacher.controller.js, which were
// the same four handlers twice over with "student"/"teacher" swapped through
// (BACKEND_AUDIT.md §5.4). Role is a parameter now, not a copy of the file.
//
// The cookie names stay `${role}AccessToken` / `${role}RefreshToken` and the
// response body still carries `role` beside the user. The frontend reads both,
// so unifying the backend must not change either.

const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 24 * 60 * 60 * 1000, // 1 day
};

export const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating Refresh And Access tokens");
    }
};

const respondWithSession = async (res, user, role, message) => {
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);
    const safeUser = await User.findById(user._id).select("-password -refreshToken");

    return res
        .status(200)
        .cookie(`${role}AccessToken`, accessToken, cookieOptions)
        .cookie(`${role}RefreshToken`, refreshToken, cookieOptions)
        .json(new ApiResponse(200, { user: safeUser, role, accessToken, refreshToken }, message));
};

export const registerUser = (role) =>
    asyncHandler(async (req, res) => {
        const { name, email, password } = req.body;

        if ([name, email, password].some((field) => !field || field.trim() === "")) {
            throw new ApiError(400, "all fields are required");
        }

        // Email is unique across ALL users now, so a teacher cannot register
        // with an address a student already holds. Name is still only checked
        // within the role, which is what the two separate collections used to
        // give us — tightening it here would reject signups that worked before.
        const existing = await User.findOne({ $or: [{ email: email.trim().toLowerCase() }, { name, role }] });
        if (existing) {
            throw new ApiError(409, "User with email or username already exits");
        }

        const user = await User.create({ name, email, password, role });

        return respondWithSession(res, user, role, "User Logged in Succesfully");
    });

export const loginUser = (role) =>
    asyncHandler(async (req, res) => {
        const { email, password } = req.body;

        if (!email || !password) {
            throw new ApiError(400, "email or password is required");
        }

        // Scoped by role: /user/teacher/login must not log someone into a
        // student account, which one shared collection would otherwise allow.
        const user = await User.findOne({ email: email.trim().toLowerCase(), role });
        if (!user) {
            throw new ApiError(404, "no such user exists");
        }

        if (!(await user.isPasswordCorrect(password))) {
            throw new ApiError(401, "Invalid User Credentials");
        }

        return respondWithSession(res, user, role, "User Logged in Succesfully");
    });

export const logoutUser = (role) =>
    asyncHandler(async (req, res) => {
        const refreshToken = req.cookies?.[`${role}RefreshToken`];

        if (!refreshToken) {
            throw new ApiError(400, "No refresh token found");
        }

        let decoded;
        try {
            decoded = jwt.verify(refreshToken, env.refreshToken.secret);
        } catch (error) {
            throw new ApiError(401, "Invalid or expired refresh token");
        }

        // $unset, not $set: undefined — the latter is a no-op in Mongoose, so
        // logout used to leave the session valid (BACKEND_AUDIT.md §1.5).
        await User.findByIdAndUpdate(decoded._id, { $unset: { refreshToken: 1 } });

        return res
            .status(200)
            .clearCookie(`${role}AccessToken`, cookieOptions)
            .clearCookie(`${role}RefreshToken`, cookieOptions)
            .json(new ApiResponse(200, {}, "User logged out"));
    });

export const getCurrentUser = asyncHandler(async (req, res) => {
    // verifyAuth already loaded req.user without password/refreshToken.
    return res.status(200).json(
        new ApiResponse(200, req.user, `Current ${req.user.role} fetched successfully`)
    );
});

/**
 * Exchanges a refresh token for a new pair.
 *
 * This used to read the user's role by looking the _id up in one collection
 * and then the other. With one collection the role is simply a field on the
 * document it already fetched.
 */
export const refreshAccessToken = asyncHandler(async (req, res) => {
    const incoming =
        req.cookies?.[`${ROLES.STUDENT}RefreshToken`] ||
        req.cookies?.[`${ROLES.TEACHER}RefreshToken`];

    if (!incoming) {
        throw new ApiError(401, "No refresh token provided");
    }

    let decoded;
    try {
        decoded = jwt.verify(incoming, env.refreshToken.secret);
    } catch (error) {
        // Only jwt.verify's own throw is caught here. Everything below must
        // propagate with its real status — wrapping the whole body in a
        // try/catch was what turned every failure into a 400 (§2.11).
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }

    if (!decoded?._id) {
        throw new ApiError(401, "Invalid refresh token");
    }

    const user = await User.findById(decoded._id);
    if (!user) {
        throw new ApiError(401, "User not found");
    }

    if (user.refreshToken !== incoming) {
        throw new ApiError(401, "Refresh token mismatch");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);
    const role = user.role;

    return res
        .status(200)
        .cookie(`${role}AccessToken`, accessToken, cookieOptions)
        .cookie(`${role}RefreshToken`, refreshToken, cookieOptions)
        .json(new ApiResponse(200, { accessToken, refreshToken, role }, "Access token refreshed"));
});
