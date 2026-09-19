import { Sections } from "../../models/section.model.js";
import { CurriculumItems } from "../../models/curriculumItem.model.js";
import { Progress } from "../../models/progress.model.js";
import { WatchPosition } from "../../models/watchPosition.model.js";
import { getViewerAccess } from "../../services/entitlement.service.js";
import { toCurriculumDTO } from "../../utils/dto/curriculum.js";

/**
 * `GET /learn/:courseId` (D5). Reuses the exact same tree shape W0-B already
 * built for `GET /courses/:courseId/curriculum` (`toCurriculumDTO`) — same
 * sections/items/media-visibility rules — and layers on top of it the two
 * things that are specific to the player: per-item `completed`, and a
 * `resume` target.
 *
 * The course owner previewing their own course gets the tree with every
 * item's `completed: false` and `resume` pointing at the first item —
 * there is no Progress document for an owner and this never creates one
 * (D5: "the course owner ... never writes progress").
 */
export async function getLearnTree({ course, viewer }) {
    const [sections, items] = await Promise.all([
        Sections.find({ course: course._id }).sort({ order: 1 }),
        CurriculumItems.find({ course: course._id }),
    ]);

    const itemsBySectionId = {};
    for (const item of items) {
        const key = String(item.section);
        (itemsBySectionId[key] ??= []).push(item);
    }

    const dto = toCurriculumDTO(course, sections, itemsBySectionId, viewer);
    const { isOwner } = getViewerAccess(viewer, course);

    let completedItemIds = new Set();
    let resume = null;

    if (!isOwner) {
        const progress = await Progress.findOne({ studentId: viewer._id, courseId: course._id });
        completedItemIds = new Set((progress?.completedItems ?? []).map(String));

        if (progress?.lastItemId) {
            const watch = await WatchPosition.findOne({ student: viewer._id, item: progress.lastItemId });
            resume = { itemId: String(progress.lastItemId), positionSec: watch?.positionSec ?? 0 };
        }
    }

    if (!resume) {
        const firstItem = dto.sections.find((section) => section.items.length > 0)?.items[0];
        resume = firstItem ? { itemId: firstItem.id, positionSec: 0 } : null;
    }

    return {
        ...dto,
        sections: dto.sections.map((section) => ({
            ...section,
            items: section.items.map((item) => ({ ...item, completed: completedItemIds.has(item.id) })),
        })),
        resume,
    };
}
