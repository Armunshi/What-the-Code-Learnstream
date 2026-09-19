import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { verifyAuth } from "../../middleware/auth.js";
import { env } from "../../config/env.js";
import { getMe, updateProfile, validateProfileBody } from "../../services/user/profile.service.js";
import { uploadAvatar, setAvatar } from "../../services/user/avatar.service.js";
import { changePassword, validatePasswordBody } from "../../services/user/password.service.js";
import { listPurchases } from "../../services/user/purchases.service.js";
import { getWishlist, addToWishlist, removeFromWishlist } from "../../services/user/wishlist.service.js";
import { getPublicProfile } from "../../services/user/publicProfile.service.js";

// docs/lanes/acc.json owns this file. Mounted at the same "/users" basePath
// as users-summary.routes.js's `/me/summary` and myLearning.routes.js's
// `/me/learning` — a third router sharing that basePath, same pattern those
// two already establish. All the static "/me/*" routes are declared before
// the single-segment "/:username" catch-all at the bottom of this file, the
// same static-before-dynamic rule api-conventions.md states for mount order
// between routers — here it also has to hold within this one router, since
// "/:username" would otherwise shadow every "/me..." path declared after it.
const router = Router();

router.get(
    "/me",
    verifyAuth,
    asyncHandler(async (req, res) => {
        const user = await getMe(req.user._id);
        return res.status(200).json(new ApiResponse(200, user, "Current user fetched successfully"));
    })
);

router.patch(
    "/me/profile",
    verifyAuth,
    validateProfileBody,
    asyncHandler(async (req, res) => {
        const user = await updateProfile(req.user._id, req.body);
        return res.status(200).json(new ApiResponse(200, user, "Profile updated successfully"));
    })
);

router.post(
    "/me/avatar",
    verifyAuth,
    uploadAvatar.single("avatar"),
    asyncHandler(async (req, res) => {
        if (!req.file) throw new ApiError(400, "An avatar image file is required");
        const result = await setAvatar(req.user._id, req.file.path);
        return res.status(200).json(new ApiResponse(200, result, "Avatar updated successfully"));
    })
);

router.patch(
    "/me/password",
    verifyAuth,
    validatePasswordBody,
    asyncHandler(async (req, res) => {
        const { accessToken, refreshToken, role } = await changePassword(req.user._id, req.body);
        return res
            .status(200)
            .cookie(`${role}AccessToken`, accessToken, env.cookieOptions)
            .cookie(`${role}RefreshToken`, refreshToken, env.cookieOptions)
            // refreshToken never leaves the httpOnly cookie in the response
            // body (api-conventions.md S-NFR-1.2).
            .json(new ApiResponse(200, { accessToken }, "Password updated — other devices have been signed out"));
    })
);

router.get(
    "/me/purchases",
    verifyAuth,
    asyncHandler(async (req, res) => {
        const items = await listPurchases(req.user._id);
        return res.status(200).json(new ApiResponse(200, { items }, "Purchases fetched successfully"));
    })
);

router.get(
    "/me/wishlist",
    verifyAuth,
    asyncHandler(async (req, res) => {
        const items = await getWishlist(req.user._id);
        return res.status(200).json(new ApiResponse(200, { items }, "Wishlist fetched successfully"));
    })
);

router.post(
    "/me/wishlist",
    verifyAuth,
    asyncHandler(async (req, res) => {
        const { courseId } = req.body ?? {};
        if (!courseId) throw new ApiError(400, "courseId is required", [{ field: "courseId", code: "required" }]);
        const items = await addToWishlist(req.user._id, courseId);
        return res.status(201).json(new ApiResponse(201, { items }, "Added to wishlist"));
    })
);

router.delete(
    "/me/wishlist/:courseId",
    verifyAuth,
    asyncHandler(async (req, res) => {
        const items = await removeFromWishlist(req.user._id, req.params.courseId);
        return res.status(200).json(new ApiResponse(200, { items }, "Removed from wishlist"));
    })
);

// Public profile — a single dynamic segment, so it must stay last in this
// router or it would shadow every "/me/..." route declared above it.
router.get(
    "/:username",
    asyncHandler(async (req, res) => {
        const profile = await getPublicProfile(req.params.username);
        return res.status(200).json(new ApiResponse(200, profile, "Profile fetched successfully"));
    })
);

export default { basePath: "/users", priority: 100, router };
