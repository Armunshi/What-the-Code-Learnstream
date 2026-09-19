import { z } from "zod";
import { ApiError } from "../../utils/ApiError.js";
import { User } from "../../models/user.model.js";
import { generateAccessAndRefreshTokens } from "../../controllers/UserAuth/auth.controller.js";

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const validatePasswordBody = (req, res, next) => {
    const result = changePasswordSchema.safeParse(req.body);
    if (!result.success) {
        const errors = result.error.issues.map((issue) => ({
            field: issue.path.join(".") || "(body)",
            code: issue.code,
        }));
        return next(new ApiError(400, "Invalid password change request", errors));
    }
    req.body = result.data;
    next();
};

/**
 * Rotates the refresh token as part of a password change, which signs out
 * every OTHER device: `user.refreshToken` holds exactly one token
 * (user.model.js — no session list), so overwriting it here invalidates
 * whatever refresh token any other session was holding, the same mechanism
 * `refreshAccessToken()` already relies on (auth.controller.js: it 401s
 * whenever the incoming refresh token doesn't match the one on the user).
 * Returns the new tokens; the caller (the route) sets cookies and shapes the
 * response — this stays a plain service function, like every other lane's.
 */
export const changePassword = async (userId, { currentPassword, newPassword }) => {
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");

    if (!(await user.isPasswordCorrect(currentPassword))) {
        throw new ApiError(401, "Current password is incorrect");
    }

    user.password = newPassword;
    await user.save();

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);
    return { accessToken, refreshToken, role: user.role };
};
