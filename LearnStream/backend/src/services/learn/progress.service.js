import { Progress } from "../../models/progress.model.js";
import { CurriculumItems } from "../../models/curriculumItem.model.js";
import { COUNTABLE_ITEM_TYPES } from "./constants.js";

/**
 * Idempotently marks `itemId` complete for `studentId` in `courseId`, then
 * recomputes percentComplete/completedAt from scratch.
 *
 * The only exported writer of `completedItems` — every other lane that adds
 * a way to complete something (W3-QUIZ's pass-a-quiz flow, per the plan) is
 * expected to call THIS, not push to Progress directly, so percentComplete
 * never drifts out of sync with completedItems.
 *
 * Same "get-or-create, then $ne-guarded $push" shape as the legacy
 * lecture.service.js markLectureCompleted — a second call for an
 * already-completed item is a no-op, not a duplicate row.
 */
export async function markItemComplete({ studentId, courseId, itemId }) {
    await Progress.findOneAndUpdate(
        { studentId, courseId },
        { $setOnInsert: { studentId, courseId } },
        { upsert: true }
    );

    await Progress.findOneAndUpdate(
        { studentId, courseId, completedItems: { $ne: itemId } },
        {
            $push: { completedItems: itemId },
            $set: { lastAccessedAt: new Date() },
        }
    );

    return recomputePercent({ studentId, courseId });
}

/**
 * Recomputes percentComplete/completedAt from the countable items actually
 * in the course right now (D5) and whatever's in completedItems. A separate
 * `$set` on purpose — never touches completedItems itself, so it can safely
 * run after any write to that array without a lost-update race.
 */
export async function recomputePercent({ studentId, courseId }) {
    const progress = await Progress.findOne({ studentId, courseId });
    if (!progress) return null;

    const [totalCountable, completedCountable] = await Promise.all([
        CurriculumItems.countDocuments({ course: courseId, type: { $in: COUNTABLE_ITEM_TYPES } }),
        CurriculumItems.countDocuments({
            course: courseId,
            type: { $in: COUNTABLE_ITEM_TYPES },
            _id: { $in: progress.completedItems },
        }),
    ]);

    const percentComplete = totalCountable > 0 ? (completedCountable / totalCountable) * 100 : 0;
    const isFullyComplete = totalCountable > 0 && completedCountable >= totalCountable;

    progress.percentComplete = percentComplete;
    progress.completedAt = isFullyComplete ? progress.completedAt ?? new Date() : null;
    await progress.save();

    return progress;
}

/** Get-or-create, for read paths (resume point, item access) that need a row to exist without marking anything complete. */
export async function getOrCreateProgress({ studentId, courseId }) {
    const progress = await Progress.findOneAndUpdate(
        { studentId, courseId },
        { $setOnInsert: { studentId, courseId } },
        { upsert: true, new: true }
    );
    return progress;
}
