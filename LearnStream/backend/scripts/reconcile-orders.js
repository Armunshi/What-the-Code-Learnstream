// Reconciliation for BACKEND_AUDIT.md §2.8.
//
// Fulfilment used to happen only inside verifyPayment, which runs only if the
// student's browser came back after checkout. Any order where that round trip
// didn't complete — closed tab, lost connectivity, a crash between Razorpay
// capturing the money and the enrollment write — is still sitting at
// status "created" while Razorpay has taken payment. Nothing in the app ever
// noticed, because nothing ever asked Razorpay.
//
// This script asks. It fetches the payments Razorpay actually recorded against
// each unfinished order and sorts them into three buckets:
//
//   1. LOST      status != "paid" with a captured payment of the right amount.
//                The student paid and was never enrolled. This is the real
//                §2.8 damage. --apply runs the same idempotent fulfilOrder()
//                the webhook uses.
//   1b. DRIFTED  status == "paid" but the student does not actually hold one or
//                more of the purchased courses. This is the failure that marker
//                fields cannot see: orders written with an empty course list
//                enrolled nobody, yet look complete locally. --apply enrolls
//                the student in what they paid for.
//   2. BACKFILL  status == "paid" but no fulfilledAt. These were fulfilled by
//                the old inline code path, which predates the fulfilledAt /
//                fulfilmentSource fields — they are already enrolled and need
//                no money moved, only the missing provenance markers. Kept
//                separate precisely so a large backfill count is never
//                mistaken for a large loss count.
//   3. ABANDONED no captured payment at all. Entirely normal: a student opened
//                checkout and never went through with it.
//
// Safe to re-run: fulfilOrder() claims an order atomically and a second run
// observes alreadyFulfilled instead of enrolling twice.
//
// Usage:
//   node scripts/reconcile-orders.js            # dry run (report only)
//   node scripts/reconcile-orders.js --apply    # fulfil the LOST, mark the BACKFILL

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import Razorpay from "razorpay";
import { DB_NAME } from "../src/constants.js";
import { Order } from "../src/models/Orders.js";
import { UserStudent } from "../src/models/user/userstudentmodel.js";
import { fulfilOrder } from "../src/utils/fulfilment.js";
import { enrollStudentInCourses } from "../src/utils/enrollment.js";

const APPLY = process.argv.includes("--apply");

const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Which of an order's purchased courses the student does not actually hold.
// A paid order whose student is missing a course is the real "paid but not
// enrolled" state: it survives any amount of marker backfilling, because the
// markers were written by a pass that enrolled nobody.
async function missingEnrollments(order) {
    const ids = (order.course_ids || []).map(String);
    if (!ids.length) return [];
    const student = await UserStudent.findById(order.user_id).select("Courses");
    if (!student) return [];
    const held = new Set((student.Courses || []).map(String));
    return ids.filter((id) => !held.has(id));
}

async function main() {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    console.log(`Connected. Mode: ${APPLY ? "APPLY (will fulfil/backfill)" : "DRY RUN (report only)"}`);

    // Every order, deliberately. An earlier version examined only orders that
    // were unpaid or lacked fulfilledAt, which is precisely the blind spot that
    // let drift hide: an order marked paid AND carrying fulfilledAt looks
    // finished by every local signal while the student holds none of the
    // courses. Only comparing each order against real enrollments finds those,
    // so the cost of one Razorpay call per order is worth paying.
    const candidates = await Order.find({});

    console.log(`\nOrders examined: ${candidates.length}`);

    const lost = [];
    const backfill = [];
    const abandoned = [];
    const failed = [];
    // Orders marked paid whose student is nonetheless missing one of the
    // purchased courses. Marker fields cannot detect this — only comparing the
    // order against the student's actual enrollments can.
    const drifted = [];
    // Paid, enrolled, and fully marked — nothing to do, counted only so the
    // totals add up to the number of orders examined.
    const settled = [];

    for (const order of candidates) {
        let payments;
        try {
            const result = await instance.orders.fetchPayments(order.razorpayOrder_id);
            payments = result.items ?? [];
        } catch (err) {
            failed.push({ order, reason: err?.error?.description || err.message });
            continue;
        }

        const captured = payments.find(
            (p) => p.status === "captured" && p.amount === order.amount
        );

        if (!captured) {
            abandoned.push({ order, statuses: payments.map((p) => p.status) });
        } else if (order.status === "paid") {
            const missing = await missingEnrollments(order);
            if (missing.length) drifted.push({ order, payment: captured, missing });
            // Only orders genuinely lacking the provenance markers belong in
            // the backfill bucket. Counting every correctly-fulfilled paid
            // order here would make each run report work that isn't needed.
            else if (!order.fulfilledAt) backfill.push({ order, payment: captured });
            else settled.push(order);
        } else {
            lost.push({ order, payment: captured });
        }
    }

    console.log(`\n=== 1. LOST — paid at Razorpay, never enrolled here: ${lost.length} ===`);
    if (!lost.length) console.log("  (none)");
    for (const { order, payment } of lost) {
        console.log(
            `  ${order.razorpayOrder_id} user=${order.user_id} ` +
            `amount=${order.amount} paise status=${order.status} ` +
            `payment=${payment.id} created=${order.createdAt?.toISOString?.() ?? "?"}`
        );
    }

    console.log(`\n=== 1b. DRIFTED — marked paid, but the student is missing courses: ${drifted.length} ===`);
    if (!drifted.length) console.log("  (none)");
    for (const { order, missing } of drifted) {
        console.log(
            `  ${order.razorpayOrder_id} user=${order.user_id} amount=${order.amount} paise ` +
            `missing=[${missing.join(", ")}]`
        );
    }

    console.log(`\n=== 2. BACKFILL — already paid and enrolled, missing markers: ${backfill.length} ===`);
    console.log("  (no money involved; these just predate fulfilledAt/fulfilmentSource)");

    console.log(`\n=== 3. ABANDONED — no captured payment: ${abandoned.length} ===`);
    console.log("  (normal: checkout opened, never paid)");

    console.log(`\n=== 4. SETTLED — paid, enrolled, fully marked: ${settled.length} ===`);
    console.log("  (nothing to do)");

    if (failed.length) {
        console.log(`\n=== Could not check with Razorpay: ${failed.length} ===`);
        for (const { order, reason } of failed) {
            console.log(`  ${order.razorpayOrder_id}: ${reason}`);
        }
    }

    if (!APPLY) {
        console.log(
            `\nDRY RUN — nothing changed. ` +
            `${lost.length} order(s) would be fulfilled, ${drifted.length} re-enrolled, ` +
            `${backfill.length} backfilled.`
        );
        console.log("Re-run with --apply to act.");
        await mongoose.disconnect();
        return;
    }

    let fulfilledCount = 0;
    for (const { order, payment } of lost) {
        try {
            const result = await fulfilOrder({
                razorpayOrderId: order.razorpayOrder_id,
                paymentId: payment.id,
                source: "webhook",
            });
            fulfilledCount += result.alreadyFulfilled ? 0 : 1;
            console.log(
                `  fulfilled ${order.razorpayOrder_id}: ${JSON.stringify(result.enrollmentResults)}`
            );
        } catch (err) {
            console.error(`  FAILED ${order.razorpayOrder_id}: ${err.message}`);
        }
    }

    // Repair drifted orders by enrolling the student in what they actually paid
    // for. fulfilOrder is not used here: the order is already claimed as paid,
    // so its atomic claim would match nothing and silently do no work.
    let reEnrolled = 0;
    for (const { order, missing } of drifted) {
        try {
            const results = await enrollStudentInCourses(order.user_id, order.course_ids);
            await Order.updateOne(
                { _id: order._id },
                { $set: { fulfilledAt: new Date(), fulfilmentSource: "verify" } }
            );
            reEnrolled += 1;
            console.log(
                `  re-enrolled ${order.razorpayOrder_id} (was missing ${missing.length}): ${JSON.stringify(results)}`
            );
        } catch (err) {
            console.error(`  FAILED re-enrolling ${order.razorpayOrder_id}: ${err.message}`);
        }
    }

    // Provenance only. fulfilmentSource is "verify" because the inline handler
    // in verifyPayment was the only fulfilment path that existed when these
    // were paid. updatedAt is the closest truthful stand-in for when that
    // happened, since paidAt didn't exist yet either.
    let backfilledCount = 0;
    for (const { order, payment } of backfill) {
        const when = order.paidAt ?? order.updatedAt ?? new Date();
        const result = await Order.updateOne(
            { _id: order._id, fulfilledAt: { $exists: false } },
            {
                $set: {
                    fulfilledAt: when,
                    paidAt: order.paidAt ?? when,
                    fulfilmentSource: "verify",
                    razorpayPayment_id: order.razorpayPayment_id ?? payment.id,
                },
            }
        );
        backfilledCount += result.modifiedCount;
    }

    console.log(
        `\nFulfilled ${fulfilledCount} lost order(s); re-enrolled ${reEnrolled} drifted; ` +
        `backfilled ${backfilledCount}.`
    );
    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error("Reconciliation failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
