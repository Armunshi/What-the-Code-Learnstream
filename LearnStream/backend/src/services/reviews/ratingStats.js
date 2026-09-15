import { Review } from "../../models/review.model.js";
import { Courses } from "../../models/course.model.js";

const BUCKETS = [1, 2, 3, 4, 5];

/**
 * Recomputes the rating slice of `course.stats` (ratingAvg, ratingCount,
 * ratingDistribution) from the Review documents that currently exist for
 * `courseId`, and writes ONLY those dotted `stats.*` paths — same rule as
 * `services/stats/curriculumStats.js`'s recomputeCurriculumStats: never the
 * whole `stats` object (concurrent writers — enrollment, content stats —
 * must not be clobbered), and never `editVersion` (a stats recompute is not
 * an authoring edit, D3).
 *
 * `ratingDistribution` stores raw per-star counts, bucketed by
 * `floor(rating)` (D7). The largest-remainder percentage conversion is a
 * presentation concern of the rating-summary endpoint, not something stored
 * here — see `toRatingDistributionPercentages` below.
 */
export const recomputeRatingStats = async (courseId) => {
    const reviews = await Review.find({ course: courseId }).select("rating").lean();

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;
    for (const { rating } of reviews) {
        const bucket = Math.min(5, Math.max(1, Math.floor(rating)));
        distribution[bucket] += 1;
        total += rating;
    }

    const ratingCount = reviews.length;
    const ratingAvg = ratingCount === 0 ? 0 : total / ratingCount;

    const update = {
        "stats.ratingAvg": ratingAvg,
        "stats.ratingCount": ratingCount,
        "stats.ratingDistribution.1": distribution[1],
        "stats.ratingDistribution.2": distribution[2],
        "stats.ratingDistribution.3": distribution[3],
        "stats.ratingDistribution.4": distribution[4],
        "stats.ratingDistribution.5": distribution[5],
    };

    await Courses.updateOne({ _id: courseId }, { $set: update });

    return { ratingAvg, ratingCount, ratingDistribution: distribution };
};

/**
 * Converts raw per-bucket counts into percentages that always sum to
 * exactly 100, using the largest-remainder method (D7 / dto.md): take each
 * bucket's exact share, floor it, then hand out the leftover percentage
 * points (100 - sum of floors) one each to the buckets with the largest
 * fractional remainder, highest first.
 *
 * Plain rounding (Math.round on each share) does not have this guarantee —
 * e.g. three buckets at 33.33% each round to 33/33/33 = 99, not 100.
 */
export const toRatingDistributionPercentages = (distribution) => {
    const total = BUCKETS.reduce((sum, star) => sum + (distribution[star] ?? 0), 0);

    const percentages = {};
    if (total === 0) {
        for (const star of BUCKETS) percentages[star] = 0;
        return percentages;
    }

    const shares = BUCKETS.map((star) => {
        const exact = ((distribution[star] ?? 0) * 100) / total;
        return { star, floor: Math.floor(exact), remainder: exact - Math.floor(exact) };
    });

    let allocated = shares.reduce((sum, s) => sum + s.floor, 0);
    let remaining = 100 - allocated;

    const byRemainderDesc = [...shares].sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < byRemainderDesc.length && remaining > 0; i++, remaining--) {
        byRemainderDesc[i].floor += 1;
    }

    for (const { star, floor } of shares) {
        percentages[star] = floor;
    }
    return percentages;
};
