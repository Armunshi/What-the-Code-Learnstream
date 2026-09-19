// CourseCardDTO — frozen shape (docs/contracts/dto.md). Used everywhere a
// course is shown as a card: catalog, search results, "you might like", the
// popover. Never includes `description` or `enrolledStudents` — both were
// dropped from the legacy getCourseById payload (plan §4 W0-B) as
// unnecessary and, in enrolledStudents' case, a privacy leak.
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * `course` must have `author` populated with at least {_id, name, username}.
 *
 * `context.isBestseller` is a caller-supplied boolean because "top 3 by
 * enrollmentCount within its category" (badge rule 1) is a fact about a
 * *set* of courses, not a single one — the caller (a catalog/search listing)
 * computes the top 3 per category once and passes the answer in for each
 * course, rather than this function re-querying siblings per card.
 */
export const toCourseCardDTO = (course, context = {}) => {
    const stats = course.stats ?? {};
    const author = course.author ?? {};

    const badge = computeBadge(course, stats, context);

    return {
        id: String(course._id),
        title: course.title,
        subtitle: course.subtitle ?? null,
        thumbnailUrl: course.thumbnail ?? null,
        // No dedicated multi-resolution asset pipeline yet — same URL at every
        // density until the media pipeline (UPL, Wave 1+) produces real
        // variants. Kept as a field, not omitted, since the shape is frozen.
        thumbnailSrcSet: course.thumbnail ? `${course.thumbnail} 1x` : null,
        author: {
            id: author._id ? String(author._id) : null,
            name: author.name ?? null,
            username: author.username ?? null,
        },
        priceInPaise: course.price ?? 0,
        isFree: (course.price ?? 0) === 0,
        currency: course.currency ?? "INR",
        category: course.category ?? null,
        subcategory: course.subcategory ?? null,
        level: course.level ?? null,
        language: course.language ?? null,
        rating: {
            avg: stats.ratingAvg ?? 0,
            count: stats.ratingCount ?? 0,
        },
        enrollmentCount: stats.enrollmentCount ?? 0,
        badge,
        totalDurationSec: stats.totalDurationSec ?? 0,
        lectureCount: stats.lectureCount ?? 0,
        hasCaptions: (stats.captionLanguages ?? []).length > 0,
        updatedAt: course.updatedAt ?? null,
        publishedAt: course.publishedAt ?? null,
        objectives: (course.learningObjectives ?? []).slice(0, 3),
    };
};

function computeBadge(course, stats, context) {
    if (context.isBestseller && (stats.enrollmentCount ?? 0) >= 5) {
        return "bestseller";
    }
    if ((stats.ratingAvg ?? 0) >= 4.5 && (stats.ratingCount ?? 0) >= 5) {
        return "highest_rated";
    }
    if (course.publishedAt && Date.now() - new Date(course.publishedAt).getTime() <= THIRTY_DAYS_MS) {
        return "new";
    }
    return null;
}

export const toCourseCardDTOs = (courses, context = {}) =>
    courses.map((course) => toCourseCardDTO(course, context));
