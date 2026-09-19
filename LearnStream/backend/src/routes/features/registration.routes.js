import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { verifyAuth } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";
import { validateQuery } from "../../middleware/validateQuery.js";
import { env } from "../../config/env.js";
import {
  registerVerifySchema,
  registerResendSchema,
  emailAvailableQuerySchema,
  onboardingSchema,
} from "../../validation/auth.schemas.js";
import { verifyRegistration, resendRegistration, isEmailAvailable } from "../../services/registration.service.js";
import { respondWithSession } from "../../controllers/UserAuth/auth.controller.js";
import { User } from "../../models/user.model.js";

// docs/lanes/auth.json owns this file. Mounted at basePath "/" (same
// reasoning as reviews.routes.js): it carries both /auth/register/... and
// /users/me/onboarding in one router, neither of which collides with any
// legacy single-segment catch-all.
const router = Router();

// Endpoints that send email, check email availability, or accept OTP
// attempts must be rate-limited (docs/contracts/api-conventions.md). Own
// limiters here rather than reusing middleware/rateLimit.js's authLimiter:
// that one is IP-only and tuned for login/signup credential stuffing, not
// the email+IP keying these endpoints specifically need.
const skipInE2E = () => env.e2eTestRoutes && !env.isProduction;

// ipKeyGenerator normalizes an IPv6 address to its /64 prefix before mixing
// it into the key — a raw req.ip would let an IPv6 caller rotate the host
// part of their address and dodge the limit entirely (express-rate-limit
// v8's own ERR_ERL_KEY_GEN_IPV6 check enforces using this helper for any
// custom keyGenerator that folds in the IP).
const emailAndIpKey = (req) => `${ipKeyGenerator(req.ip)}:${(req.body?.email || req.query?.email || "").toLowerCase()}`;

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailAndIpKey,
  skip: skipInE2E,
  handler: (req, res, next) => next(new ApiError(429, "Too many attempts. Please try again later.")),
});

const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: emailAndIpKey,
  skip: skipInE2E,
  handler: (req, res, next) => next(new ApiError(429, "Too many attempts. Please try again later.")),
});

const emailAvailableLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  // IP alone, per docs/contracts/api-conventions.md — there's no request
  // body/email to combine it with reliably for a debounced-as-you-type check.
  skip: skipInE2E,
  handler: (req, res, next) => next(new ApiError(429, "Too many attempts. Please try again later.")),
});

router.post(
  "/auth/register/verify",
  verifyLimiter,
  validate(registerVerifySchema),
  asyncHandler(async (req, res) => {
    const user = await verifyRegistration(req.body);
    return respondWithSession(res, user, user.role, "Account verified", 201);
  })
);

router.post(
  "/auth/register/resend",
  resendLimiter,
  validate(registerResendSchema),
  asyncHandler(async (req, res) => {
    const result = await resendRegistration(req.body);
    return res.status(200).json(new ApiResponse(200, result, "Verification code resent"));
  })
);

router.get(
  "/auth/email-available",
  emailAvailableLimiter,
  validateQuery(emailAvailableQuerySchema),
  asyncHandler(async (req, res) => {
    const available = await isEmailAvailable(req.query.email);
    return res.status(200).json(new ApiResponse(200, { available }, "Checked"));
  })
);

router.patch(
  "/users/me/onboarding",
  verifyAuth,
  validate(onboardingSchema),
  asyncHandler(async (req, res) => {
    const { phone, interests, dismissed } = req.body;
    const update = {};
    if (phone !== undefined) update.phone = phone;
    if (interests !== undefined) update.interests = interests;
    if (dismissed !== undefined) update["onboarding.dismissed"] = dismissed;

    const user = await User.findByIdAndUpdate(req.user._id, { $set: update }, { new: true }).select(
      "-password -refreshToken"
    );
    if (!user) {
      throw new ApiError(404, "User not found");
    }

    return res.status(200).json(new ApiResponse(200, user, "Onboarding updated"));
  })
);

export default { basePath: "/", priority: 100, router };
