import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { CurriculumItems, VideoItem, ArticleItem } from "../../models/curriculumItem.model.js";
import { recomputeCurriculumStats } from "../../services/stats/curriculumStats.js";

// e2e-only scaffolding (docs/contracts/api-conventions.md: routes/test/*
// mounts ONLY when E2E_TEST_ROUTES=1 && !isProduction — enforced by
// mountTestRoutes/app.js, not re-checked here).
//
// `e2e/seeds/learn.seed.ts` needs a video item, an article item and a
// caption/transcript attached to that video, and there is no real
// authoring endpoint for any of that yet (W2-CURR/W2-CAPT are Wave 2+) — so
// this gives the seed a direct way to create them without waiting on those
// lanes. Two routes, both under the one test-route file LEARN owns.
const router = Router();

router.post(
    "/items",
    asyncHandler(async (req, res) => {
        const { courseId, sectionId, type, title, durationSec, body, mp4Url, isFreePreview } = req.body;
        if (!courseId || !sectionId || !type || !title) {
            throw new ApiError(400, "courseId, sectionId, type and title are required");
        }

        const order = await CurriculumItems.countDocuments({ section: sectionId });
        let item;
        if (type === "video") {
            item = await VideoItem.create({
                course: courseId,
                section: sectionId,
                title,
                order,
                durationSec: durationSec ?? 0,
                isFreePreview: Boolean(isFreePreview),
                media: {
                    provider: "fake",
                    status: "READY",
                    statusChangedAt: new Date(),
                    durationSec: durationSec ?? 0,
                    mp4Url: mp4Url ?? null,
                    captions: [],
                },
            });
        } else if (type === "article") {
            item = await ArticleItem.create({
                course: courseId,
                section: sectionId,
                title,
                order,
                durationSec: durationSec ?? 0,
                isFreePreview: Boolean(isFreePreview),
                body: body ?? "",
            });
        } else {
            throw new ApiError(400, `Unsupported test-seed item type: ${type}`);
        }

        await recomputeCurriculumStats(courseId);

        return res.status(201).json(new ApiResponse(201, { itemId: String(item._id) }, "Test item created"));
    })
);

router.post(
    "/items/:itemId/captions",
    asyncHandler(async (req, res) => {
        const { lang = "en", label = "English", url, isDefault = true, transcriptText = "" } = req.body;
        const item = await VideoItem.findById(req.params.itemId);
        if (!item) throw new ApiError(404, "Video item not found");

        item.media.captions = [{ lang, label, url, isDefault }];
        item.media.transcriptText = transcriptText;
        await item.save();

        return res.status(200).json(new ApiResponse(200, { itemId: String(item._id) }, "Caption attached"));
    })
);

export default { basePath: "/test/learn", priority: 100, router };
