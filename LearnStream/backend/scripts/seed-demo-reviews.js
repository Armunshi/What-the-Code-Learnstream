// Demo/dev seeding script (docs/lanes/rev.json): writes a handful of
// plausible reviews onto PUBLISHED courses that have enrolled students but
// no reviews yet, so the review UI and homepage social proof have something
// to render on a freshly-seeded dev database. NOT one of the four W0
// migrations (domain-model.md "Related migrations") and not run in CI —
// purely a local/demo convenience, same spirit as the rest of scripts/.
//
// Idempotent: a course that already has at least one review is skipped
// entirely, and within a course, only enrolled students who haven't already
// reviewed it are used — running this twice never creates duplicates (the
// (course, user) unique index would reject them anyway; this just avoids
// noisy "already reviewed" errors in the log).
//
// Usage:
//   node scripts/seed-demo-reviews.js            # dry run (default)
//   node scripts/seed-demo-reviews.js --dry-run   # dry run (explicit)
//   node scripts/seed-demo-reviews.js --apply     # actually write

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { DB_NAME } from "../src/constants.js";
import { Courses } from "../src/models/course.model.js";
import { Review } from "../src/models/review.model.js";
import { COURSE_STATUS } from "../src/config/courseLifecycle.js";
import { recomputeRatingStats } from "../src/services/reviews/ratingStats.js";

const APPLY = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
const MAX_REVIEWS_PER_COURSE = 6;

const RATINGS = [5, 5, 4.5, 4, 4.5, 3.5, 5, 4];
const COMMENTS = [
    "Really clear explanations, worked through every example myself.",
    "Great pacing — I was worried it would be too basic but it wasn't.",
    "Solid course overall. A couple of sections felt rushed.",
    "Exactly what I needed to get unblocked at work. Recommended.",
    "Instructor explains the 'why', not just the 'how'. Loved it.",
    "Good content, audio quality could be better in a few lectures.",
    "Finished it in a weekend. Practical and to the point.",
    "One of the better courses I've taken on this topic.",
];

function pick(arr, index) {
    return arr[index % arr.length];
}

async function main() {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    console.log(`Connected. Mode: ${APPLY ? "APPLY (will write demo reviews)" : "DRY RUN (report only)"}`);

    const courses = await Courses.find({
        status: COURSE_STATUS.PUBLISHED,
        "enrolledStudents.0": { $exists: true },
    }).select("title enrolledStudents");

    let coursesSeeded = 0;
    let reviewsCreated = 0;

    for (const course of courses) {
        const existingReviewerIds = new Set(
            (await Review.find({ course: course._id }).select("user").lean()).map((r) => r.user.toString())
        );
        if (existingReviewerIds.size > 0) {
            console.log(`- skip "${course.title}" (already has ${existingReviewerIds.size} review(s))`);
            continue;
        }

        const candidates = course.enrolledStudents
            .map((id) => id.toString())
            .filter((id) => !existingReviewerIds.has(id))
            .slice(0, MAX_REVIEWS_PER_COURSE);

        if (candidates.length === 0) continue;

        console.log(`- "${course.title}": would create ${candidates.length} review(s)`);
        if (!APPLY) continue;

        for (let i = 0; i < candidates.length; i++) {
            await Review.create({
                course: course._id,
                user: candidates[i],
                rating: pick(RATINGS, i),
                comment: pick(COMMENTS, i),
            });
            reviewsCreated++;
        }
        await recomputeRatingStats(course._id);
        coursesSeeded++;
    }

    console.log(
        `\nDone. ${APPLY ? "Created" : "Would create"} ${reviewsCreated} review(s) across ${
            APPLY ? coursesSeeded : "N"
        } course(s).`
    );
    if (!APPLY) {
        console.log("Re-run with --apply to write these reviews.");
    }

    await mongoose.disconnect();
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
