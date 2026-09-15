import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Courses } from "../../models/course.model.js";
import { TAXONOMY } from "../../config/taxonomy.js";
import { COURSE_STATUS } from "../../config/courseLifecycle.js";
import { optionalAuth } from "../../middleware/auth.js";
import { validateQuery } from "../../middleware/validateQuery.js";
import { visibleCourseFilter } from "../../services/course.service.js";
import { toCourseCardDTOs } from "../../utils/dto/courseCard.js";

// Two NEW static endpoints under /courses (docs/contracts/dto.md,
// docs/contracts/api-conventions.md "Route mounting"). Both are single
// extra path segments (/courses/categories, /courses/cards) that would
// otherwise be swallowed by the legacy GET /courses/:courseId catch-all —
// see app.js for how mountFeatureRoutes() is ordered ahead of the legacy
// CourseRouter specifically so these win.
const router = Router();

router.get(
    "/categories",
    asyncHandler(async (req, res) => {
        const counts = await Courses.aggregate([
            { $match: { status: COURSE_STATUS.PUBLISHED } },
            { $group: { _id: "$category", count: { $sum: 1 } } },
        ]);
        const countByCategory = new Map(counts.map((c) => [c._id, c.count]));

        const categories = TAXONOMY.map((category) => ({
            slug: category.slug,
            label: category.label,
            courseCount: countByCategory.get(category.slug) ?? 0,
            subcategories: category.subcategories.map((sub) => ({
                slug: sub.slug,
                label: sub.label,
                topics: sub.topics,
            })),
        }));

        return res.status(200).json(new ApiResponse(200, { categories }, "Categories fetched successfully"));
    })
);

const cardsQuerySchema = z.object({ ids: z.string().min(1) });

router.get(
    "/cards",
    optionalAuth,
    validateQuery(cardsQuerySchema),
    asyncHandler(async (req, res) => {
        const ids = req.query.ids
            .split(",")
            .map((id) => id.trim())
            .filter(Boolean);
        if (ids.length === 0) {
            throw new ApiError(400, "ids must contain at least one course id");
        }

        // visibleCourseFilter, not a bare status check: a viewer's own draft
        // (owner) or a course they're enrolled in past unpublish (student)
        // should still resolve to a card here, same as everywhere else
        // courses are listed (D2).
        const courses = await Courses.find({ _id: { $in: ids }, ...visibleCourseFilter(req.user) }).populate(
            "author",
            "name username"
        );

        return res.status(200).json(new ApiResponse(200, { items: toCourseCardDTOs(courses) }, "Course cards fetched successfully"));
    })
);

export default { basePath: "/courses", priority: 10, router };
