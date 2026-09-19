// Wave 0 backfill (D3 `stats`, docs/contracts/domain-model.md): computes and
// writes course.stats.* from existing data. Run this AFTER
// migrate-w0-curriculum-v2.js — it counts CurriculumItems, which don't exist
// until that migration has created them (a course with no CurriculumItems
// yet just gets all-zero content stats, which is correct, not wrong).
//
// Each course's stats.* fields are $set together here, in one document per
// course — that is fine for a one-time backfill. The RULE this has to keep
// working going forward lives in services/stats/curriculumStats.js: ongoing
// writers `$set` only their own dotted stats.* paths, never bump editVersion,
// and never replace the whole `stats` object at once (concurrent writers —
// enrollment, reviews, media processing — would clobber each other). This
// script runs once, before any of those concurrent writers exist for a given
// course's data, so writing the whole object here is safe.
//
// ratingAvg/ratingCount: existing courses only ever had a single legacy
// `rating` field with no review history behind it, so this seeds
// ratingAvg=course.rating (0 if unset), ratingCount=0, and an all-zero
// ratingDistribution — there is no historical per-review data to distribute.
//
// IDEMPOTENT: recomputing and $set-ing the same stats twice produces the same
// result (no marker needed — this is naturally idempotent, unlike the other
// three W0 migrations which build/rename data), but a `migrations` marker is
// still recorded for consistency with the other three and so
// `check-lane-ownership`/CI tooling can see it ran.
//
// Usage:
//   node scripts/backfill-w0-course-stats.js            # dry run (default)
//   node scripts/backfill-w0-course-stats.js --dry-run   # dry run (explicit)
//   node scripts/backfill-w0-course-stats.js --apply     # actually write

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { DB_NAME } from "../src/constants.js";

const APPLY = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
const MIGRATION_ID = "w0-course-stats-backfill";

async function main() {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    console.log(`Connected. Mode: ${APPLY ? "APPLY (will modify course stats)" : "DRY RUN (report only)"}`);

    const coursesCol = mongoose.connection.collection("courses");
    const itemsCol = mongoose.connection.collection("curriculumitems");

    const courses = await coursesCol.find({}).project({ title: 1, rating: 1, enrolledStudents: 1 }).toArray();
    console.log(`\nCourses found: ${courses.length}`);

    const ops = [];
    for (const course of courses) {
        const items = await itemsCol.find({ course: course._id }).toArray();

        let totalDurationSec = 0;
        let lectureCount = 0;
        let articleCount = 0;
        let quizCount = 0;
        let resourceCount = 0;
        const captionLanguages = new Set();
        const practiceTypes = new Set();

        for (const item of items) {
            totalDurationSec += item.durationSec ?? 0;
            if (item.type === "video") {
                lectureCount++;
                for (const caption of item.media?.captions ?? []) {
                    if (caption?.lang) captionLanguages.add(caption.lang);
                }
            } else if (item.type === "article") {
                articleCount++;
            } else if (item.type === "quiz") {
                quizCount++;
                if (item.quizKind) practiceTypes.add(item.quizKind);
            } else if (item.type === "resource") {
                resourceCount++;
            }
        }

        const enrollmentCount = Array.isArray(course.enrolledStudents) ? course.enrolledStudents.length : 0;

        ops.push({
            updateOne: {
                filter: { _id: course._id },
                update: {
                    $set: {
                        "stats.totalDurationSec": totalDurationSec,
                        "stats.lectureCount": lectureCount,
                        "stats.articleCount": articleCount,
                        "stats.quizCount": quizCount,
                        "stats.resourceCount": resourceCount,
                        "stats.captionLanguages": [...captionLanguages],
                        "stats.practiceTypes": [...practiceTypes],
                        "stats.ratingAvg": course.rating ?? 0,
                        "stats.ratingCount": 0,
                        "stats.ratingDistribution": { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
                        "stats.enrollmentCount": enrollmentCount,
                    },
                },
            },
        });

        console.log(
            `  "${course.title}" → duration=${totalDurationSec}s lectures=${lectureCount} articles=${articleCount} ` +
            `quizzes=${quizCount} resources=${resourceCount} enrollments=${enrollmentCount}`
        );
    }

    if (!APPLY) {
        console.log(`\nDRY RUN — nothing changed. ${ops.length} course(s) would be updated.`);
        await mongoose.disconnect();
        return;
    }

    if (ops.length) {
        const result = await coursesCol.bulkWrite(ops);
        console.log(`\nModified ${result.modifiedCount} of ${ops.length} courses.`);
    } else {
        console.log("\nNo courses to update.");
    }

    const migrations = mongoose.connection.collection("migrations");
    await migrations.updateOne(
        { _id: MIGRATION_ID },
        { $set: { _id: MIGRATION_ID, appliedAt: new Date(), courseCount: ops.length, note: "D3 stats backfill from existing data" } },
        { upsert: true }
    );

    console.log(`\nRecorded migration marker "${MIGRATION_ID}".`);
    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error("Migration failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
