import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { verifyAuth, requireRole } from "../../middleware/auth.js";
import { requireEnrollment } from "../../middleware/requireEnrollment.js";
import { CurriculumItems } from "../../models/curriculumItem.model.js";
import { getViewerAccess } from "../../services/entitlement.service.js";
import { getLearnTree } from "../../services/learn/tree.service.js";
import { touchItemAccess, recordPosition } from "../../services/learn/watch.service.js";
import { completeItem } from "../../services/learn/completion.service.js";

// The LMS player (D5, docs/contracts/domain-model.md). Every route here
// requires an entitled viewer (owner or enrolled student) — `requireEnrollment
// ('course')` resolves `:courseId` via the SAME shared `courseResolvers.course`
// the legacy lecture/assignment routes use, so it accepts either
// `:course_id` or `:courseId` and attaches `req.course`.
const router = Router();

router.get(
    "/:courseId",
    verifyAuth,
    requireEnrollment("course"),
    asyncHandler(async (req, res) => {
        const tree = await getLearnTree({ course: req.course, viewer: req.user });
        return res.status(200).json(new ApiResponse(200, tree, "Learn tree fetched successfully"));
    })
);

router.get(
    "/:courseId/items/:itemId",
    verifyAuth,
    requireEnrollment("course"),
    asyncHandler(async (req, res) => {
        const { itemId } = req.params;
        const item = await CurriculumItems.findOne({ _id: itemId, course: req.course._id });
        if (!item) throw new ApiError(404, "Item not found in this course");

        // The owner previewing their own course never writes progress (D5) —
        // touchItemAccess (which sets lastItemId / the watch baseline) only
        // runs for a genuinely entitled STUDENT viewer.
        const { isOwner } = getViewerAccess(req.user, req.course);
        if (!isOwner) {
            await touchItemAccess({ studentId: req.user._id, courseId: req.course._id, itemId: item._id });
        }

        return res.status(200).json(new ApiResponse(200, { itemId: String(item._id) }, "Item access recorded"));
    })
);

router.put(
    "/:courseId/items/:itemId/position",
    verifyAuth,
    // Student-only: this also guarantees the owner-never-writes-progress
    // rule for the two mutating endpoints below, by construction rather
    // than by remembering to check isOwner in every handler.
    requireRole("student"),
    requireEnrollment("course"),
    asyncHandler(async (req, res) => {
        const { positionSec, watchedDeltaSec, playbackRate } = req.body;
        const result = await recordPosition({
            studentId: req.user._id,
            courseId: req.course._id,
            itemId: req.params.itemId,
            positionSec,
            watchedDeltaSec,
            playbackRate,
        });
        return res.status(200).json(new ApiResponse(200, result, "Position recorded"));
    })
);

router.post(
    "/:courseId/items/:itemId/complete",
    verifyAuth,
    requireRole("student"),
    requireEnrollment("course"),
    asyncHandler(async (req, res) => {
        const progress = await completeItem({
            studentId: req.user._id,
            courseId: req.course._id,
            itemId: req.params.itemId,
        });
        return res.status(200).json(new ApiResponse(200, progress, "Item marked complete"));
    })
);

export default { basePath: "/learn", priority: 100, router };
