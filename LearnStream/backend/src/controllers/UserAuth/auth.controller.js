import jwt from "jsonwebtoken";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { env } from "../../config/env.js";
import { ROLES, User } from "../../models/user.model.js";
import { startRegistration } from "../../services/registration.service.js";

// Replaces UserStudent.controller.js and UserTeacher.controller.js, which were
// the same four handlers twice over with "student"/"teacher" swapped through
// (BACKEND_AUDIT.md §5.4). Role is a parameter now, not a copy of the file.
//
// The cookie names stay `${role}AccessToken` / `${role}RefreshToken` and the
// response body still carries `role` beside the user. The frontend reads both,
// so unifying the backend must not change either.

// In production, the frontend (learnstream-chi.vercel.app) and this API
// (onrender.com) are different domains, so these cookies are cross-site by
// construction and require sameSite: "none". Without `partitioned`, that
// makes them ordinary third-party cookies — exactly the kind Chrome now
// blocks or silently drops by default, which reproduced as real students
// getting signed out mid-session on any request that relied on the cookie
// alone rather than the bearer token (confirmed: production Set-Cookie
// headers had no Partitioned attribute, and curl-based reproduction with
// cookies present worked while requests over the same cookie failed in the
// browser).
//
// `partitioned: true` opts into CHIPS (Cookies Having Independent Partitioned
// State): the cookie is still Secure and HttpOnly, but is stored in a
// partition keyed to the top-level site (learnstream-chi.vercel.app), which
// Chrome permits even with third-party cookies otherwise blocked. Express's
// bundled `cookie` package (0.7.1+) emits the `Partitioned` attribute for this
// option; older cookie-parser versions would silently drop it, so don't
// downgrade past what's pinned in package-lock.json.
//
// These flags are NODE_ENV-derived (BACKEND_AUDIT.md §3.12) — see
// config/env.js's `cookieOptions` for the single definition, including why
// local dev needs different values than production.
const cookieOptions = env.cookieOptions;

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

// Exported (was module-private) so routes/features/registration.routes.js's
// POST /auth/register/verify can create the SAME session shape this file's
// own login/register-legacy paths do, once OTP verification succeeds —
// session creation is a controller concern (cookies), not something
// registration.service.js's pure business logic should duplicate.
//
// JSON response bodies never carry `refreshToken` (S-NFR-1.2,
// docs/contracts/api-conventions.md "Auth middleware") — it lives only in
// the httpOnly cookie set below. This used to also put it in the JSON body,
// which W0-B flagged as a real violation for this lane to fix.
export const respondWithSession = async (res, user, role, message, statusCode = 200) => {
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);
    const safeUser = await User.findById(user._id).select("-password -refreshToken");

    return res
        .status(statusCode)
        .cookie(`${role}AccessToken`, accessToken, cookieOptions)
        .cookie(`${role}RefreshToken`, refreshToken, cookieOptions)
        .json(new ApiResponse(statusCode, { user: safeUser, role, accessToken }, message));
};

// POST /user/:role/signup no longer creates the account directly (plan
// S-FR-1.2/S-FR-2.1's OTP-signup design): it starts a pendingRegistration
// and emails a code, returning 202 with no session. The account — and any
// session — only exists after POST /auth/register/verify succeeds
// (routes/features/registration.routes.js). e2e/lib/api-client.ts's
// completeSignup was specifically built to accept either status for this
// reason (see its doc comment).
export const registerUser = (role) =>
    asyncHandler(async (req, res) => {
        const { name, firstName, lastName, email, password } = req.body;

        const result = await startRegistration({ name, firstName, lastName, email, password, role });

        return res.status(202).json(new ApiResponse(202, result, "Verification code sent"));
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

        return respondWithSession(res, user, role, "User logged in successfully");
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
        .json(new ApiResponse(200, { accessToken, role }, "Access token refreshed"));
});
