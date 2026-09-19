import { getViewerAccess } from "../../services/entitlement.service.js";

// Curriculum tree DTO (docs/contracts/dto.md, `GET /courses/:courseId/curriculum`).
//
// The shape is the same for a guest and an entitled viewer — same sections,
// same items, same titles/order/durations/isFreePreview — but a non-entitled
// viewer's items carry NO media/body/resource fields at all. This is
// deliberately stricter than "hide publicId": even the derived mp4Url/hlsUrl
// are withheld from a non-entitled viewer, because a free-preview item's
// actual playable URL is only ever handed out by the separate
// GET /courses/:courseId/items/:itemId/playback endpoint, never embedded in
// the tree itself. That keeps this endpoint safe to cache/share regardless
// of whether a given item happens to be a free preview.
const itemDTO = (item, isEntitled) => {
    const base = {
        id: String(item._id),
        type: item.type,
        title: item.title,
        order: item.order,
        durationSec: item.durationSec ?? 0,
        isFreePreview: Boolean(item.isFreePreview),
    };

    if (!isEntitled) return base;

    switch (item.type) {
        case "video":
            return {
                ...base,
                media: {
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
                },
            };
        case "article":
            return { ...base, body: item.body ?? "", readingTimeSec: item.readingTimeSec ?? 0 };
        case "resource":
            return {
                ...base,
                file: item.file
                    ? { url: item.file.url, filename: item.file.filename, sizeBytes: item.file.sizeBytes, mimeType: item.file.mimeType }
                    : null,
            };
        case "assignment":
            return { ...base, assignmentId: item.assignment ? String(item.assignment) : null };
        case "quiz":
            return { ...base, quizId: item.quiz ? String(item.quiz) : null, quizKind: item.quizKind ?? "quiz" };
        default:
            return base;
    }
};

/**
 * `sections` — Sections docs for this course, any order.
 * `itemsBySectionId` — Map/plain object of sectionId (string) -> CurriculumItems[].
 */
export const toCurriculumDTO = (course, sections, itemsBySectionId, viewer) => {
    const { isEntitled } = getViewerAccess(viewer, course);

    const sortedSections = [...sections].sort((a, b) => a.order - b.order);

    return {
        courseId: String(course._id),
        curriculumVersion: course.curriculumVersion ?? 0,
        sections: sortedSections.map((section) => {
            const items = itemsBySectionId[String(section._id)] ?? [];
            return {
                id: String(section._id),
                title: section.title,
                learningObjective: section.learningObjective ?? null,
                order: section.order,
                items: [...items]
                    .sort((a, b) => a.order - b.order)
                    .map((item) => itemDTO(item, isEntitled)),
            };
        }),
    };
};
