import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { env } from "../config/env.js";
import { User } from "../models/user.model.js";

// The cookie names are role-prefixed and set by auth.controller.js. They are
// checked in both spellings because a browser can hold either, and the
// Authorization header is the fallback the e2e suite and API clients use.
//
// Getting this wrong is silent and looks like an intermittent auth bug: the
// header-bearing calls succeed and the cookie-bearing ones 401, so only some
// requests on a page fail.
const readToken = (req) =>
    req.cookies?.studentAccessToken ||
    req.cookies?.teacherAccessToken ||
    req.cookies?.accessToken ||
    req.header("Authorization")?.replace(/^Bearer\s*/i, "").trim();

/**
 * The one auth middleware. Replaces authstudent, authteacher and authcombined.
 *
 * Those three existed only because role was not in the token: each had to
 * decide who the caller was by looking the _id up in a particular collection,
 * and verifyJWTCombined had to assign the same header to both `teacherToken`
 * and `studentToken` and try each collection in turn (BACKEND_AUDIT.md §5.4).
 * With one users collection and a `role` claim there is one lookup and no
 * guessing.
 *
 * Sets `req.user`. Pair it with requireRole when a route is role-specific.
 */
export const verifyAuth = asyncHandler(async (req, res, next) => {
    const token = readToken(req);
    if (!token) {
        throw new ApiError(401, "Unauthorized - no access token provided");
    }

    let decoded;
    try {
        decoded = jwt.verify(token, env.accessToken.secret);
    } catch (error) {
        throw new ApiError(401, "Unauthorized - access token is invalid or expired");
    }

    const user = await User.findById(decoded._id).select("-password -refreshToken");
    if (!user) {
        throw new ApiError(401, "Unauthorized - user no longer exists");
    }

    req.user = user;
    next();
});

/**
 * Route guard: the caller's role must be one of `roles`.
 *
 * Read from the user record rather than the token claim. The two agree in
 * normal operation, but a role changed after a token was issued should take
 * effect immediately rather than at the next login.
 */
export const requireRole = (...roles) =>
    asyncHandler(async (req, res, next) => {
        if (!req.user) {
            throw new ApiError(401, "Authentication is required");
        }
        if (!roles.includes(req.user.role)) {
            throw new ApiError(403, `This action requires the ${roles.join(" or ")} role`);
        }
        next();
    });
