import { COURSE_STATUS } from "../../config/courseLifecycle.js";

// CoursePublicDTO (docs/contracts/dto.md, `GET /courses/:courseId/landing`).
// No live route wires this up yet in W0-B — the landing endpoint itself
// belongs to a Wave 1 lane (W1-CAT) — but the DTO shape is frozen now so
// that lane doesn't have to guess at it.
//
// `instructor` fields beyond name/username/avatar/headline/bio
// (courseCount/totalStudents/avgRating) are aggregates the caller has to
// supply — this function only shapes what it's given, it never queries.
export const toCoursePublicDTO = (course, instructor) => {
    const isPublic = course.status === COURSE_STATUS.PUBLISHED;

    return {
        id: String(course._id),
        title: course.title,
        subtitle: course.subtitle ?? null,
        description: course.description,
        thumbnail: course.thumbnail ?? null,
        // A promo video is only ever playable through this DTO for a
        // PUBLISHED course — an unpublished course's promo is still visible
        // to its owner through the authoring UI, which reads the raw course
        // document directly rather than this public-facing shape.
        promoVideo: isPublic
            ? {
                  mp4Url: course.promoVideo?.mp4Url ?? null,
                  hlsUrl: course.promoVideo?.hlsUrl ?? null,
                  posterUrl: course.promoVideo?.posterUrl ?? null,
              }
            : null,
        stats: course.stats ?? {},
        instructor: {
            id: instructor?._id ? String(instructor._id) : null,
            name: instructor?.name ?? null,
            username: instructor?.username ?? null,
            avatar: instructor?.avatar ?? null,
            headline: instructor?.headline ?? null,
            bio: instructor?.bio ?? null,
            courseCount: instructor?.courseCount ?? 0,
            totalStudents: instructor?.totalStudents ?? 0,
            avgRating: instructor?.avgRating ?? 0,
        },
        learningObjectives: course.learningObjectives ?? [],
        requirements: course.requirements ?? [],
        targetAudience: course.targetAudience ?? [],
    };
};
