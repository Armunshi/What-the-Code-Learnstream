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
// Where the local `course_id` is unusable (some orders stored an empty array),
// it falls back to the Razorpay order's `notes`, which createOrder has always
// populated with the course ids. That is authoritative data from the payment
// provider, not a guess, and it recovers every order this script would
// otherwise have to skip.
//
// Skipped, and reported rather than guessed at:
//   - orders recoverable from neither the local field nor Razorpay's notes
//   - orders whose course ids point at courses that no longer exist
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
import Razorpay from "razorpay";
import { DB_NAME } from "../src/constants.js";

const APPLY = process.argv.includes("--apply");

const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// createOrder writes the purchased course ids into the Razorpay order's notes,
// as a comma-separated string under `course_ids` (older orders used a singular
// `course_id`). That copy survives even when the local field does not.
const courseIdsFromRazorpayNotes = async (razorpayOrderId) => {
    try {
        const remote = await instance.orders.fetch(razorpayOrderId);
        const raw = remote?.notes?.course_ids ?? remote?.notes?.course_id ?? "";
        return String(raw)
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    } catch (err) {
        console.error(`    could not fetch ${razorpayOrderId} from Razorpay: ${err?.error?.description || err.message}`);
        return [];
    }
};

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

    // Resolve each order's course ids: prefer the local legacy field, fall back
    // to Razorpay's notes for the ones that stored nothing usable.
    const resolved = [];
    const unrecoverable = [];
    for (const o of legacy) {
        if (isValidObjectId(String(o.course_id ?? ""))) {
            resolved.push({ order: o, ids: [String(o.course_id)], via: "local" });
            continue;
        }
        const fromNotes = (await courseIdsFromRazorpayNotes(o.razorpayOrder_id)).filter(isValidObjectId);
        if (fromNotes.length) {
            resolved.push({ order: o, ids: fromNotes, via: "razorpay-notes" });
        } else {
            unrecoverable.push(o);
        }
    }

    const wellFormed = resolved;
    const malformed = unrecoverable;

    const referenced = [...new Set(wellFormed.flatMap((r) => r.ids))];
    const existing = await mongoose.connection
        .collection("courses")
        .find({ _id: { $in: referenced.map((id) => new mongoose.Types.ObjectId(id)) } })
        .project({ _id: 1 })
        .toArray();
    const liveIds = new Set(existing.map((c) => String(c._id)));

    // Keep only ids whose course still exists; an order keeps whatever survives.
    const convertible = [];
    const deadCourse = [];
    for (const r of wellFormed) {
        const live = r.ids.filter((id) => liveIds.has(id));
        if (live.length) convertible.push({ ...r, ids: live });
        else deadCourse.push(r);
    }

    console.log(`  convertible (course still exists): ${convertible.length}`);
    console.log(`    of which recovered from Razorpay notes: ${convertible.filter((r) => r.via === "razorpay-notes").length}`);
    console.log(`  unrecoverable (no local id, no notes): ${malformed.length}`);
    console.log(`  all referenced courses deleted:       ${deadCourse.length}`);

    for (const o of malformed) {
        console.log(`    SKIP ${o.razorpayOrder_id} — course_id=${JSON.stringify(o.course_id)} status=${o.status}`);
    }
    for (const r of deadCourse) {
        console.log(`    SKIP ${r.order.razorpayOrder_id} — course(s) ${r.ids.join(",")} no longer exist, status=${r.order.status}`);
    }
    for (const r of convertible.filter((x) => x.via === "razorpay-notes")) {
        console.log(`    RECOVERED ${r.order.razorpayOrder_id} via Razorpay notes → ${r.ids.join(",")}`);
    }

    if (!APPLY) {
        console.log(`\nDRY RUN — nothing changed. ${convertible.length} order(s) would be converted.`);
        await mongoose.disconnect();
        return;
    }

    if (convertible.length) {
        const result = await orders.bulkWrite(
            convertible.map((r) => ({
                updateOne: {
                    filter: { _id: r.order._id },
                    update: { $set: { course_ids: r.ids.map((id) => new mongoose.Types.ObjectId(id)) } },
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
