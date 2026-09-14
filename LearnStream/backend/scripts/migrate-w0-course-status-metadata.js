// Wave 0 migration (D2/D3, docs/contracts/domain-model.md):
//   1. Every existing course becomes `status: 'PUBLISHED'` with
//      `publishedAt = createdAt` — new courses created after this ships
//      start as DRAFT (that default lives on the schema, not here).
//   2. Backfills a `category`/`subcategory` taxonomy slug pair onto every
//      existing course, using config/taxonomy.js. Existing courses store a
//      free-text `category` (e.g. "E2E-A", "General") that predates the
//      taxonomy — there is no reliable mapping from that text to a specific
//      taxonomy slug, so this assigns a deterministic (hash-based, not
//      random) category/subcategory pair per course rather than guessing.
//      This keeps `visibleCourseFilter`'s `{status, category, subcategory}`
//      index usable immediately; a real content-classification pass is out
//      of scope for Wave 0.
//
// IDEMPOTENT via a `migrations` marker (see migrate-prices-to-paise.js for
// the same pattern) — a second run is a no-op.
//
// Usage:
//   node scripts/migrate-w0-course-status-metadata.js            # dry run (default)
//   node scripts/migrate-w0-course-status-metadata.js --dry-run   # dry run (explicit)
//   node scripts/migrate-w0-course-status-metadata.js --apply     # actually write

import dotenv from "dotenv";
dotenv.config();

import crypto from "crypto";
import mongoose from "mongoose";
import { DB_NAME } from "../src/constants.js";
import { TAXONOMY } from "../src/config/taxonomy.js";
import { COURSE_STATUS } from "../src/config/courseLifecycle.js";

const APPLY = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
const MIGRATION_ID = "w0-course-status-metadata";

/** Deterministic category/subcategory pick from a course id — stable across runs. */
function taxonomyFor(courseId) {
    const hash = crypto.createHash("md5").update(String(courseId)).digest();
    const category = TAXONOMY[hash[0] % TAXONOMY.length];
    const subcategory = category.subcategories[hash[1] % category.subcategories.length];
    return { category: category.slug, subcategory: subcategory.slug };
}

async function main() {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    console.log(`Connected. Mode: ${APPLY ? "APPLY (will modify courses)" : "DRY RUN (report only)"}`);

    const migrations = mongoose.connection.collection("migrations");
    const already = await migrations.findOne({ _id: MIGRATION_ID });
    if (already) {
        console.log(
            `\nAlready applied at ${already.appliedAt?.toISOString?.() ?? already.appliedAt} ` +
            `(${already.courseCount} courses). Nothing to do — re-running is a safe no-op.`
        );
        await mongoose.disconnect();
        return;
    }

    const coursesCol = mongoose.connection.collection("courses");
    const courses = await coursesCol
        .find({ status: { $exists: false } })
        .project({ title: 1, createdAt: 1 })
        .toArray();

    console.log(`\nCourses without a status (pre-D2): ${courses.length}`);

    const ops = courses.map((course) => {
        const { category, subcategory } = taxonomyFor(course._id);
        return {
            updateOne: {
                filter: { _id: course._id },
                update: {
                    $set: {
                        status: COURSE_STATUS.PUBLISHED,
                        publishedAt: course.createdAt ?? new Date(),
                        subcategory,
                        // Only backfilled when the course's free-text category isn't
                        // already a valid taxonomy slug — a course authored after
                        // this migration lands may already carry a real slug.
                        ...(TAXONOMY.some((c) => c.slug === course.category) ? {} : { category }),
                    },
                },
            },
        };
    });

    ops.forEach(({ updateOne }, i) => {
        const course = courses[i];
        console.log(
            `  "${course.title}" → status=PUBLISHED publishedAt=${(course.createdAt ?? new Date()).toISOString?.() ?? course.createdAt} ` +
            `category/subcategory=${JSON.stringify(updateOne.update.$set.category ?? "(kept)")}` +
            `/${updateOne.update.$set.subcategory}`
        );
    });

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

    await migrations.insertOne({
        _id: MIGRATION_ID,
        appliedAt: new Date(),
        courseCount: ops.length,
        note: "D2 status backfill (PUBLISHED, publishedAt=createdAt) + D3 taxonomy slug backfill",
    });

    console.log(`\nRecorded migration marker "${MIGRATION_ID}". Re-runs are now a no-op.`);
    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error("Migration failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
