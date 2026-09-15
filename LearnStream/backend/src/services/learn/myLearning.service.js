import { User } from "../../models/user.model.js";
import { Courses } from "../../models/course.model.js";
import { Progress } from "../../models/progress.model.js";

/**
 * `GET /users/me/learning` (D5). One row per enrolled course — no `price`
 * field at all, by design (L-FR-4.2: "no price on owned courses" — the
 * frontend simply has nothing to render, rather than being trusted to hide
 * a field it was handed).
 */
export async function getMyLearning(studentId) {
    const user = await User.findById(studentId).select("Courses");
    const courseIds = user?.Courses ?? [];
    if (courseIds.length === 0) return [];

    const [courses, progresses] = await Promise.all([
        Courses.find({ _id: { $in: courseIds } }).populate("author", "name"),
        Progress.find({ studentId, courseId: { $in: courseIds } }),
    ]);

    const progressByCourseId = new Map(progresses.map((progress) => [String(progress.courseId), progress]));

    return courses.map((course) => {
        const progress = progressByCourseId.get(String(course._id));
        const percentComplete = progress?.percentComplete ?? 0;
        const status = percentComplete >= 100 ? "completed" : percentComplete > 0 ? "in_progress" : "not_started";

        return {
            courseId: String(course._id),
            title: course.title,
            thumbnailUrl: course.thumbnail,
            authorName: course.author?.name ?? null,
            percentComplete,
            status,
            resumeItemId: progress?.lastItemId ? String(progress.lastItemId) : null,
            lastAccessedAt: progress?.lastAccessedAt ?? null,
        };
    });
}
