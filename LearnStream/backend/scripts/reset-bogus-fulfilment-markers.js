// One-off correction for BACKEND_AUDIT.md §2.8.
//
// The first `reconcile-orders.js --apply` run (2026-09-12) stamped five orders
// as paid + fulfilled while enrolling nobody. Those orders predate the
// multi-course cart and store a singular `course_id` the schema doesn't
// declare, so Mongoose reported `course_ids: []`, enrollStudentInCourses
// looped zero times, and fulfilment "succeeded" having done nothing.
// fulfilOrder now refuses that case outright, but these five records were
// written before the guard existed.
//
// They must be reset rather than left alone: reconcile-orders.js only
// considers orders that are not paid or lack fulfilledAt, so in their current
// state these five would be skipped forever while carrying markers that claim
// an enrollment that never happened.
//
// Run this AFTER migrate-legacy-order-course-ids.js, then re-run
// reconcile-orders.js --apply, which will fulfil them for real. No student is
// affected either way — the one student involved is already enrolled in the
// course. This corrects the records, not anyone's access.
//
// Targets an explicit id list, and only touches a document still in the exact
// bad state, so it cannot clobber a later legitimate fulfilment.
//
// Usage:
//   node scripts/reset-bogus-fulfilment-markers.js            # dry run
//   node scripts/reset-bogus-fulfilment-markers.js --apply    # reset

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { DB_NAME } from "../src/constants.js";

const APPLY = process.argv.includes("--apply");

const TARGETS = [
    "order_QlYj69zDBf7ZR4",
    "order_QlYqCSNvFkGD4D",
    "order_QlYChZLmvT7B20",
    "order_QlYDrpW16XQiqf",
    "order_QlY5zBpvCpYaOS",
];

async function main() {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    console.log(`Connected. Mode: ${APPLY ? "APPLY (will reset markers)" : "DRY RUN (report only)"}`);

    const orders = mongoose.connection.collection("orders");
    const docs = await orders.find({ razorpayOrder_id: { $in: TARGETS } }).toArray();

    console.log(`\nTargets found: ${docs.length} of ${TARGETS.length}`);
    for (const o of docs) {
        console.log(
            `  ${o.razorpayOrder_id} status=${o.status} ` +
            `fulfilledAt=${o.fulfilledAt ? o.fulfilledAt.toISOString() : "none"} ` +
            `source=${o.fulfilmentSource ?? "none"} course_ids=${(o.course_ids || []).length}`
        );
    }

    // Only reset documents still in the bad state written by that run.
    const resettable = docs.filter(
        (o) => o.status === "paid" && o.fulfilmentSource === "webhook" && o.fulfilledAt
    );
    console.log(`\nIn the bad state and resettable: ${resettable.length}`);

    if (!APPLY) {
        console.log(`\nDRY RUN — nothing changed. ${resettable.length} order(s) would be reset to "created".`);
        await mongoose.disconnect();
        return;
    }

    if (resettable.length) {
        const result = await orders.updateMany(
            { _id: { $in: resettable.map((o) => o._id) } },
            {
                $set: { status: "created" },
                $unset: {
                    paidAt: "",
                    fulfilledAt: "",
                    fulfilmentSource: "",
                    razorpayPayment_id: "",
                },
            }
        );
        console.log(`\nReset ${result.modifiedCount} order(s) to their pre-reconcile state.`);
        console.log("Now re-run: node scripts/reconcile-orders.js --apply");
    } else {
        console.log("\nNothing to reset.");
    }

    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error("Reset failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
