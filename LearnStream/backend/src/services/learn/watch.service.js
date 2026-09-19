import { ApiError } from "../../utils/ApiError.js";
import { CurriculumItems } from "../../models/curriculumItem.model.js";
import { WatchPosition } from "../../models/watchPosition.model.js";
import { Progress } from "../../models/progress.model.js";
import { markItemComplete } from "./progress.service.js";

/**
 * Called from `GET /learn/:courseId/items/:itemId` — sets `lastItemId` (D5)
 * and, for a video item, (re)establishes the WatchPosition row's
 * `lastHeartbeatAt` baseline. That baseline is what the very first `PUT
 * .../position` call after opening the item gets capped against, so
 * "open the item, immediately claim you watched the last 90% of it" caps to
 * ~0 instead of trusting whatever delta the client reports.
 */
export async function touchItemAccess({ studentId, courseId, itemId }) {
    const item = await CurriculumItems.findOne({ _id: itemId, course: courseId });
    if (!item) throw new ApiError(404, "Item not found");

    const now = new Date();
    await Progress.findOneAndUpdate(
        { studentId, courseId },
        { $setOnInsert: { studentId, courseId }, $set: { lastItemId: itemId, lastAccessedAt: now } },
        { upsert: true }
    );

    if (item.type === "video") {
        await WatchPosition.findOneAndUpdate(
            { student: studentId, item: itemId },
            { $setOnInsert: { student: studentId, course: courseId, item: itemId }, $set: { lastHeartbeatAt: now } },
            { upsert: true }
        );
    }

    return item;
}

/**
 * `PUT /learn/:courseId/items/:itemId/position` (D5). Only video items carry
 * a watch position — the player never heartbeats for article/resource/
 * assignment/quiz renderers.
 *
 * The delta cap is the actual security property here (L-FR-4.1): a client
 * can report any `watchedDeltaSec` it likes, but the server only ever
 * credits up to `elapsedWallClockSec x playbackRate` of it, so seeking to
 * the end and reporting "I watched all of it" caps to (near) zero instead
 * of completing the item.
 */
export async function recordPosition({ studentId, courseId, itemId, positionSec, watchedDeltaSec, playbackRate }) {
    const item = await CurriculumItems.findOne({ _id: itemId, course: courseId });
    if (!item) throw new ApiError(404, "Item not found");
    if (item.type !== "video") {
        throw new ApiError(400, "Only video items track a watch position");
    }

    const now = new Date();
    const rate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
    const clampedPosition = Math.max(0, Number(positionSec) || 0);
    const requestedDelta = Math.max(0, Number(watchedDeltaSec) || 0);

    const existing = await WatchPosition.findOne({ student: studentId, item: itemId });
    // No prior heartbeat baseline (e.g. the item-access touch never ran) —
    // credit nothing rather than trust an unbounded first delta.
    const elapsedSec = existing ? Math.max(0, (now - existing.lastHeartbeatAt) / 1000) : 0;
    const cappedDelta = Math.min(requestedDelta, elapsedSec * rate);

    const watchedSec = (existing?.watchedSec ?? 0) + cappedDelta;

    const updated = await WatchPosition.findOneAndUpdate(
        { student: studentId, item: itemId },
        {
            $setOnInsert: { student: studentId, course: courseId, item: itemId },
            $set: { positionSec: clampedPosition, watchedSec, playbackRate: rate, lastHeartbeatAt: now },
        },
        { upsert: true, new: true }
    );

    await Progress.findOneAndUpdate(
        { studentId, courseId },
        { $setOnInsert: { studentId, courseId }, $set: { lastItemId: itemId, lastAccessedAt: now } },
        { upsert: true }
    );

    const durationSec = item.durationSec || item.media?.durationSec || 0;
    let completed = false;
    if (durationSec > 0 && updated.watchedSec >= 0.9 * durationSec) {
        await markItemComplete({ studentId, courseId, itemId });
        completed = true;
    }

    return { positionSec: updated.positionSec, watchedSec: updated.watchedSec, completed };
}
