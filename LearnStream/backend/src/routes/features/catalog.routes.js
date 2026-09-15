import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { optionalAuth } from "../../middleware/auth.js";
import { validateQuery } from "../../middleware/validateQuery.js";
import { publicCache } from "../../middleware/cacheControl.js";
import { getCatalog, getCourseLanding } from "../../services/catalog/index.js";

// W1-CAT's two new endpoints (docs/contracts/dto.md, plan §4 W1-CAT):
// GET /courses/catalog (a single path segment, so — like /categories and
// /cards in courses-discovery.routes.js — it has to win over the legacy
// GET /courses/:courseId catch-all; mountFeatureRoutes() in app.js runs this
// whole registry ahead of the legacy CourseRouter for exactly that reason)
// and GET /courses/:courseId/landing (multi-segment, never collides
// regardless of mount order, same as courses-curriculum.routes.js's paths).
const router = Router();

const catalogQuerySchema = z.object({
    category: z.string().trim().min(1).optional(),
    subcategory: z.string().trim().min(1).optional(),
    sort: z.enum(["popular", "newest", "rating", "price-low", "price-high"]).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(48).optional(),
});

router.get(
    "/catalog",
    publicCache(60, 600),
    validateQuery(catalogQuerySchema),
    asyncHandler(async (req, res) => {
        const { category, subcategory, sort, page, limit } = req.query;
        const result = await getCatalog({ category, subcategory, sort, page, limit });
        return res.status(200).json(new ApiResponse(200, result, "Catalog fetched successfully"));
    })
);

router.get(
    "/:courseId/landing",
    optionalAuth,
    asyncHandler(async (req, res) => {
        const dto = await getCourseLanding(req.params.courseId, req.user);
        return res.status(200).json(new ApiResponse(200, dto, "Course landing fetched successfully"));
    })
);

export default { basePath: "/courses", priority: 20, router };
