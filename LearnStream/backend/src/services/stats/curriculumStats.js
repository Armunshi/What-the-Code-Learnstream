import { CurriculumItems } from "../../models/curriculumItem.model.js";
import { Courses } from "../../models/course.model.js";

/**
 * Recomputes the content-derived slice of `course.stats` (duration, per-type
 * counts, caption languages, practice types) from the CurriculumItems that
 * currently exist for `courseId`, and writes ONLY those dotted `stats.*`
 * paths — never the whole `stats` object, and never `editVersion`.
 *
 * Both rules come straight from D3 (docs/contracts/domain-model.md): stats
 * writers must not clobber what a concurrent writer (enrollment, reviews,
 * media processing) just wrote to a sibling stats.* path, and must never
 * bump editVersion — that field exists so authoring writes can detect a
 * genuine concurrent edit, and a stats recompute is not one.
 *
 * Rating/enrollment fields are deliberately untouched here — they belong to
 * the reviews (W1-REV) and enrollment services respectively, which is why
 * this only ever $sets the content-derived subset.
 */
export const recomputeCurriculumStats = async (courseId) => {
    const items = await CurriculumItems.find({ course: courseId }).lean();

    let totalDurationSec = 0;
    let lectureCount = 0;
    let articleCount = 0;
    let quizCount = 0;
    let resourceCount = 0;
    const captionLanguages = new Set();
    const practiceTypes = new Set();

    for (const item of items) {
        totalDurationSec += item.durationSec ?? 0;

        switch (item.type) {
            case "video":
                lectureCount++;
                for (const caption of item.media?.captions ?? []) {
                    if (caption?.lang) captionLanguages.add(caption.lang);
                }
                break;
            case "article":
                articleCount++;
                break;
            case "quiz":
                quizCount++;
                if (item.quizKind) practiceTypes.add(item.quizKind);
                break;
            case "resource":
                resourceCount++;
                break;
            default:
                break;
        }
    }

    const update = {
        "stats.totalDurationSec": totalDurationSec,
        "stats.lectureCount": lectureCount,
        "stats.articleCount": articleCount,
        "stats.quizCount": quizCount,
        "stats.resourceCount": resourceCount,
        "stats.captionLanguages": [...captionLanguages],
        "stats.practiceTypes": [...practiceTypes],
    };

    await Courses.updateOne({ _id: courseId }, { $set: update });

    return update;
};
