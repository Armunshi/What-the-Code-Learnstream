import { describe, it, expect } from "vitest";
import { recomputeRatingStats, toRatingDistributionPercentages } from "../ratingStats.js";
import { Review } from "../../../models/review.model.js";
import { Courses } from "../../../models/course.model.js";
import { createTeacher, createStudent, createCourse } from "../../../../tests/helpers.js";

describe("W1-REV — recomputeRatingStats", () => {
    it("writes only stats.rating* dotted paths, never editVersion or enrollmentCount", async () => {
        const teacher = await createTeacher();
        const course = await createCourse(teacher);
        await Courses.updateOne(
            { _id: course._id },
            { $set: { editVersion: 3, "stats.enrollmentCount": 7, "stats.lectureCount": 2 } }
        );

        const studentA = await createStudent();
        const studentB = await createStudent();
        await Review.create({ course: course._id, user: studentA._id, rating: 5 });
        await Review.create({ course: course._id, user: studentB._id, rating: 3 });

        await recomputeRatingStats(course._id);

        const refreshed = await Courses.findById(course._id);
        expect(refreshed.stats.ratingAvg).toBe(4);
        expect(refreshed.stats.ratingCount).toBe(2);
        expect(refreshed.stats.ratingDistribution[3]).toBe(1);
        expect(refreshed.stats.ratingDistribution[5]).toBe(1);
        // Untouched siblings — proves this was a dotted $set, not a whole-object replace.
        expect(refreshed.stats.enrollmentCount).toBe(7);
        expect(refreshed.stats.lectureCount).toBe(2);
        expect(refreshed.editVersion).toBe(3);
    });

    it("buckets a rating by floor(), so a 4.5 lands in the 4-star bucket", async () => {
        const teacher = await createTeacher();
        const course = await createCourse(teacher);
        const student = await createStudent();
        await Review.create({ course: course._id, user: student._id, rating: 4.5 });

        await recomputeRatingStats(course._id);

        const refreshed = await Courses.findById(course._id);
        expect(refreshed.stats.ratingDistribution[4]).toBe(1);
        expect(refreshed.stats.ratingDistribution[5]).toBe(0);
    });

    it("resets to all-zero when the last review is gone", async () => {
        const teacher = await createTeacher();
        const course = await createCourse(teacher);
        await recomputeRatingStats(course._id);

        const refreshed = await Courses.findById(course._id);
        expect(refreshed.stats.ratingAvg).toBe(0);
        expect(refreshed.stats.ratingCount).toBe(0);
    });
});

describe("W1-REV — toRatingDistributionPercentages (largest-remainder method)", () => {
    it("always sums to exactly 100, even when plain rounding would not", () => {
        // 1/3, 1/3, 1/3 rounds to 33/33/33 = 99 under naive rounding.
        const pct = toRatingDistributionPercentages({ 1: 0, 2: 0, 3: 1, 4: 1, 5: 1 });
        const sum = Object.values(pct).reduce((a, b) => a + b, 0);
        expect(sum).toBe(100);
        expect(pct[3] + pct[4] + pct[5]).toBe(100);
    });

    it("gives the leftover point(s) to the largest remainder(s)", () => {
        // 7 total: 1->1 (14.28%), 5->6 (85.71%). Floors: 14 + 85 = 99, one
        // point left over, goes to whichever bucket has the larger remainder
        // (5-star: .71 > 1-star: .28).
        const pct = toRatingDistributionPercentages({ 1: 1, 2: 0, 3: 0, 4: 0, 5: 6 });
        expect(pct[1] + pct[5]).toBe(100);
        expect(pct[5]).toBeGreaterThan(pct[1]);
    });

    it("returns all zeros for an empty distribution instead of dividing by zero", () => {
        const pct = toRatingDistributionPercentages({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
        expect(Object.values(pct)).toEqual([0, 0, 0, 0, 0]);
    });
});
