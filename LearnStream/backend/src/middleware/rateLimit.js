import rateLimit from "express-rate-limit";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";

// Unlimited credential stuffing on /login, /signup and /refresh-Token was the
// gap (BACKEND_AUDIT.md §4.7). Keyed by IP (the default), which is a coarse
// fit behind a shared NAT but is the same trade-off morgan's access log
// already accepts, and needs no extra infrastructure.
//
// Skipped entirely when E2E_TEST_ROUTES=1: a full e2e/Playwright run does
// real logins per spec plus AuthProvider's refresh-on-every-mount behavior,
// which blows through a 20-per-15-minutes budget partway through the suite
// — the resulting 429 then cascades into "Login Failed" and unrelated-
// looking timeouts in whatever spec runs next. This is the same flag that
// gates routes/test/*.routes.js (docs/contracts/api-conventions.md — "never
// gate a PRODUCTION code path behind this flag"), and this isn't one: the
// limiter still fully applies whenever E2E_TEST_ROUTES is unset or false,
// which is every real deployment. `env.isProduction` is checked too, purely
// as defense in depth — E2E_TEST_ROUTES should never be set in production,
// but a rate limiter is exactly the wrong place to find that out the hard
// way if it ever is.
const skipInE2E = () => env.e2eTestRoutes && !env.isProduction;

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInE2E,
  handler: (req, res, next) => {
    next(new ApiError(429, "Too many attempts. Please try again later."));
  },
});
