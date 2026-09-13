import rateLimit from "express-rate-limit";
import { ApiError } from "../utils/ApiError.js";

// Unlimited credential stuffing on /login, /signup and /refresh-Token was the
// gap (BACKEND_AUDIT.md §4.7). Keyed by IP (the default), which is a coarse
// fit behind a shared NAT but is the same trade-off morgan's access log
// already accepts, and needs no extra infrastructure.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(new ApiError(429, "Too many attempts. Please try again later."));
  },
});
