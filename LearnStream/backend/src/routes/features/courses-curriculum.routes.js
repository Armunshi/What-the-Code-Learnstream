import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { Courses } from "../../models/course.model.js";
import { Sections } from "../../models/section.model.js";
import { CurriculumItems } from "../../models/curriculumItem.model.js";
import { optionalAuth } from "../../middleware/auth.js";
import { getViewerAccess, canPlayItem } from "../../services/entitlement.service.js";
import { toCurriculumDTO } from "../../utils/dto/curriculum.js";

// New D1 curriculum-tree and playback endpoints (docs/contracts/dto.md).
// Both paths are multi-segment under /courses/:courseId/..., so — unlike
// courses-discovery.routes.js's /categories and /cards — they never collide
// with the legacy single-segment GET /courses/:courseId route regardless of
// mount order; priority here only has to be a value, not a specific one.
const router = Router();

router.get(
    "/:courseId/curriculum",
    optionalAuth,
    asyncHandler(async (req, res) => {
        const { courseId } = req.params;
        const course = await Courses.findById(courseId);
        if (!course) throw new ApiError(404, "Course not found");

        const { isOwner } = getViewerAccess(req.user, course);
        // A draft's curriculum is visible only to its owner — same rule
        // visibleCourseFilter applies to course listings (D2), applied here
        // to a single-course fetch instead of a list filter.
        if (course.status !== "PUBLISHED" && !isOwner) {
            throw new ApiError(404, "Course not found");
        }

        const [sections, items] = await Promise.all([
            Sections.find({ course: course._id }).sort({ order: 1 }),
            CurriculumItems.find({ course: course._id }),
        ]);

        const itemsBySectionId = {};
        for (const item of items) {
            const key = String(item.section);
            (itemsBySectionId[key] ??= []).push(item);
        }

        const dto = toCurriculumDTO(course, sections, itemsBySectionId, req.user);
        return res.status(200).json(new ApiResponse(200, dto, "Curriculum fetched successfully"));
    })
);

router.get(
    "/:courseId/items/:itemId/playback",
    optionalAuth,
    asyncHandler(async (req, res) => {
        const { courseId, itemId } = req.params;
        const course = await Courses.findById(courseId);
        if (!course) throw new ApiError(404, "Course not found");

        const item = await CurriculumItems.findOne({ _id: itemId, course: course._id });
        if (!item) throw new ApiError(404, "Item not found");

        // Entitled viewer (owner/enrolled), or any viewer when the item is a
        // free preview in a PUBLISHED course — otherwise 403, never 404, so
        // the frontend can distinguish "doesn't exist" from "not entitled"
        // (docs/contracts/dto.md "Playback").
        if (!canPlayItem(req.user, course, item)) {
            throw new ApiError(403, "You are not entitled to play this item");
        }

        // No progress write happens here by design — including for the
        // course owner previewing their own content (dto.md: "The course
        // owner previewing their own course never triggers progress
        // writes"). Progress is the LEARN lane's job (Wave 1); this endpoint
        // only ever reads.
        let payload;
        switch (item.type) {
            case "video":
                payload = {
                    type: "video",
                    status: item.media?.status ?? "NONE",
                    mp4Url: item.media?.mp4Url ?? null,
                    hlsUrl: item.media?.hlsUrl ?? null,
                    posterUrl: item.media?.posterUrl ?? null,
                    captions: (item.media?.captions ?? []).map((caption) => ({
                        lang: caption.lang,
                        label: caption.label,
                        url: caption.url,
                        isDefault: caption.isDefault,
                    })),
                };
                break;
            case "article":
                payload = { type: "article", body: item.body ?? "" };
                break;
            case "resource":
                payload = {
                    type: "resource",
                    file: item.file
                        ? { url: item.file.url, filename: item.file.filename, mimeType: item.file.mimeType }
                        : null,
                };
                break;
            default:
                payload = { type: item.type };
        }

        return res.status(200).json(new ApiResponse(200, payload, "Playback data fetched successfully"));
    })
);

export default { basePath: "/courses", priority: 50, router };
