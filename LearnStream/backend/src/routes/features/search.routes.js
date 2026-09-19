import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { validateQuery } from "../../middleware/validateQuery.js";
import { validate } from "../../middleware/validate.js";
import { publicCache, cacheControl } from "../../middleware/cacheControl.js";
import { env } from "../../config/env.js";
import { EVENTS_RATE_LIMIT_MAX, EVENTS_RATE_LIMIT_WINDOW_MS } from "../../config/search.js";
import {
  searchQuerySchema,
  suggestQuerySchema,
  relatedQuerySchema,
  freshQuerySchema,
  searchEventSchema,
} from "../../validation/search.schemas.js";
import {
  getTrendingQueries,
  getSuggestions,
  searchCourses,
  getRelatedQueries,
  getFreshCourses,
  logSearchEvent,
} from "../../services/search/index.js";

// docs/lanes/src.json owns this file, mounted at priority 10 — BELOW
// courses-discovery.routes.js's own priority-10 /courses/categories and
// /courses/cards (this file sorts after that one alphabetically within the
// same priority, which doesn't matter here since none of these paths
// collide with each other) but, same as every other priority-10/20 feature
// route, still ahead of the legacy GET /courses/:courseId catch-all
// (app.js: mountFeatureRoutes() runs before `app.use('/courses', CourseRouter)`).
// /courses/search is the one single-segment path here that NEEDS that
// ordering; /courses/search/* are multi-segment and would never collide
// regardless.
const router = Router();

// Same skip-in-e2e reasoning as authLimiter (middleware/rateLimit.js) —
// this stays a real limiter in every actual deployment, and only steps
// aside for a full Playwright run so a suite that fires many suggest/search
// keystrokes doesn't trip a 429 that looks like an unrelated failure two
// specs later.
const skipInE2E = () => env.e2eTestRoutes && !env.isProduction;

const eventsLimiter = rateLimit({
  windowMs: EVENTS_RATE_LIMIT_WINDOW_MS,
  limit: EVENTS_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInE2E,
  handler: (req, res, next) => next(new ApiError(429, "Too many search events. Please slow down.")),
});

router.get(
  "/search/trending",
  publicCache(300, 600),
  asyncHandler(async (req, res) => {
    const queries = await getTrendingQueries();
    return res.status(200).json(new ApiResponse(200, { queries }, "Trending queries fetched"));
  })
);

router.get(
  "/search/suggest",
  cacheControl({ maxAge: 30, staleWhileRevalidate: 60 }),
  validateQuery(suggestQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await getSuggestions(req.query.q);
    return res.status(200).json(new ApiResponse(200, result, "Suggestions fetched"));
  })
);

router.get(
  "/search/related",
  publicCache(300, 600),
  validateQuery(relatedQuerySchema),
  asyncHandler(async (req, res) => {
    const queries = await getRelatedQueries(req.query.q);
    return res.status(200).json(new ApiResponse(200, { queries }, "Related queries fetched"));
  })
);

router.get(
  "/search/fresh",
  publicCache(300, 600),
  validateQuery(freshQuerySchema),
  asyncHandler(async (req, res) => {
    const items = await getFreshCourses(req.query.q);
    return res.status(200).json(new ApiResponse(200, { items }, "Fresh courses fetched"));
  })
);

router.post(
  "/search/events",
  // D6's table: "no-store" — cacheControl.js's factory only ever emits
  // "public|private, max-age=…", not the distinct no-store directive this
  // write endpoint needs, so it's set directly here instead of reusing it.
  (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  },
  eventsLimiter,
  validate(searchEventSchema),
  asyncHandler(async (req, res) => {
    await logSearchEvent(req.body);
    return res.status(204).send();
  })
);

router.get(
  "/search",
  publicCache(60, 120),
  validateQuery(searchQuerySchema),
  asyncHandler(async (req, res) => {
    const { q, cert, rating, lang, practice, duration, topic, level, subs, price, sort, page, limit } = req.query;
    const result = await searchCourses({
      q,
      filters: { cert, rating, lang, practice, duration, topic, level, subs, price },
      sort,
      page,
      limit,
    });
    return res.status(200).json(new ApiResponse(200, result, "Search results fetched"));
  })
);

export default { basePath: "/courses", priority: 10, router };
