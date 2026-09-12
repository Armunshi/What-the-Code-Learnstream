// One-off data migration supporting BACKEND_AUDIT.md §2.8 reconciliation.
//
// Orders written before the multi-course cart stored a singular `course_id`
// string. The current schema declares only `course_ids` (an array), so
// Mongoose silently hides the legacy field: reading one of these orders yields
// `course_ids: []`, and any fulfilment attempt enrolls nobody while happily
// reporting success. 37 of 64 orders are in this shape.
//
// This copies `course_id` into `course_ids: [course_id]` so legacy orders
// become readable by the current code and reconciliation can tell the truth
// about them. The legacy field is left in place — it costs nothing and is the
// only provenance for what happened.
//
// Skipped, and reported rather than guessed at:
//   - orders whose course_id is an empty string (at least one exists)
//   - orders whose course_id points at a course that no longer exists
//
// Idempotent: it only touches orders that have `course_id` and lack a
// populated `course_ids`, so a second run is a no-op.
//
// Usage:
//   node scripts/migrate-legacy-order-course-ids.js            # dry run
//   node scripts/migrate-legacy-order-course-ids.js --apply    # convert

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { DB_NAME } from "../src/constants.js";

const APPLY = process.argv.includes("--apply");

const isValidObjectId = (v) =>
    typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v);

async function main() {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    console.log(`Connected. Mode: ${APPLY ? "APPLY (will modify orders)" : "DRY RUN (report only)"}`);

    const orders = mongoose.connection.collection("orders");
    const legacy = await orders
        .find({
            course_id: { $exists: true },
            $or: [{ course_ids: { $exists: false } }, { course_ids: { $size: 0 } }],
        })
        .toArray();

    console.log(`\nLegacy orders (course_id set, course_ids empty/absent): ${legacy.length}`);

    const malformed = legacy.filter((o) => !isValidObjectId(String(o.course_id ?? "")));
    const wellFormed = legacy.filter((o) => isValidObjectId(String(o.course_id ?? "")));

    const referenced = [...new Set(wellFormed.map((o) => String(o.course_id)))];
    const existing = await mongoose.connection
        .collection("courses")
        .find({ _id: { $in: referenced.map((id) => new mongoose.Types.ObjectId(id)) } })
        .project({ _id: 1 })
        .toArray();
    const liveIds = new Set(existing.map((c) => String(c._id)));

    const convertible = wellFormed.filter((o) => liveIds.has(String(o.course_id)));
    const deadCourse = wellFormed.filter((o) => !liveIds.has(String(o.course_id)));

    console.log(`  convertible (course still exists): ${convertible.length}`);
    console.log(`  course_id malformed/empty:         ${malformed.length}`);
    console.log(`  course_id points at a dead course: ${deadCourse.length}`);

    for (const o of malformed) {
        console.log(`    SKIP ${o.razorpayOrder_id} — course_id=${JSON.stringify(o.course_id)} status=${o.status}`);
    }
    for (const o of deadCourse) {
        console.log(`    SKIP ${o.razorpayOrder_id} — course ${o.course_id} no longer exists, status=${o.status}`);
    }

    if (!APPLY) {
        console.log(`\nDRY RUN — nothing changed. ${convertible.length} order(s) would be converted.`);
        await mongoose.disconnect();
        return;
    }

    if (convertible.length) {
        const result = await orders.bulkWrite(
            convertible.map((o) => ({
                updateOne: {
                    filter: { _id: o._id },
                    update: { $set: { course_ids: [new mongoose.Types.ObjectId(String(o.course_id))] } },
                },
            }))
        );
        console.log(`\nConverted ${result.modifiedCount} of ${convertible.length} orders.`);
    } else {
        console.log("\nNothing to convert.");
    }

    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error("Migration failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
