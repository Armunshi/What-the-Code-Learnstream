// One-off data migration.
//
// course.model.js's `editVersion` field (the optimistic-lock guard PATCH
// …/instructor/courses/:courseId/learners compares against, D2/D3) was added
// with `default: 0` — but a schema default only applies when Mongoose builds
// or hydrates a document, never to bytes already sitting in the database. Any
// course created before this field existed has no `editVersion` key at all.
//
// That breaks the optimistic lock permanently, not just once: the guard is a
// raw query filter, `findOneAndUpdate({ _id, editVersion }, ...)`, and Mongo's
// `{ editVersion: 0 }` does NOT match a document where the field is absent
// (only `{ editVersion: null }` matches both `null` and "missing"). So the
// write always reports a conflict, the 409's `current` document is re-read
// with Mongoose's hydration default papering over the same absent field
// (still showing `editVersion: 0` to the client), and "overwrite with the
// latest version" resends that same `0` — which fails exactly the same way,
// forever. No value the frontend could ever send fixes this; only an actual
// write to the stored document does.
//
// IDEMPOTENT via a `migrations` marker (see migrate-prices-to-paise.js for
// the same pattern) — a second run is a no-op.
//
// Usage:
//   node scripts/backfill-course-editversion.js            # dry run (default)
//   node scripts/backfill-course-editversion.js --apply    # actually write

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { DB_NAME } from "../src/constants.js";

const APPLY = process.argv.includes("--apply");
const MIGRATION_ID = "courses-editversion-backfill";

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
        .find({ editVersion: { $exists: false } })
        .project({ title: 1 })
        .toArray();

    console.log(`\nCourses without an editVersion (pre-D2/D3 optimistic lock): ${courses.length}`);
    courses.forEach((course) => console.log(`  "${course.title}" → editVersion=0`));

    if (!APPLY) {
        console.log(`\nDRY RUN — nothing changed. ${courses.length} course(s) would be updated.`);
        await mongoose.disconnect();
        return;
    }

    if (courses.length) {
        const result = await coursesCol.updateMany(
            { editVersion: { $exists: false } },
            { $set: { editVersion: 0 } }
        );
        console.log(`\nModified ${result.modifiedCount} of ${courses.length} courses.`);
    } else {
        console.log("\nNo courses to update.");
    }

    await migrations.insertOne({
        _id: MIGRATION_ID,
        appliedAt: new Date(),
        courseCount: courses.length,
        note: "editVersion backfill (0) for courses that predate the optimistic-lock field",
    });

    console.log(`\nRecorded migration marker "${MIGRATION_ID}". Re-runs are now a no-op.`);
    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error("Migration failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
