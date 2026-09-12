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
import { fulfilOrder } from "../src/utils/fulfilment.js";

const APPLY = process.argv.includes("--apply");

const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

async function main() {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    console.log(`Connected. Mode: ${APPLY ? "APPLY (will fulfil/backfill)" : "DRY RUN (report only)"}`);

    // Anything not demonstrably finished: never marked paid, or marked paid but
    // carrying none of the fulfilment provenance the current code writes.
    const candidates = await Order.find({
        $or: [{ status: { $ne: "paid" } }, { fulfilledAt: { $exists: false } }],
    });

    console.log(`\nOrders examined: ${candidates.length}`);

    const lost = [];
    const backfill = [];
    const abandoned = [];
    const failed = [];

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
            backfill.push({ order, payment: captured });
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

    console.log(`\n=== 2. BACKFILL — already paid and enrolled, missing markers: ${backfill.length} ===`);
    console.log("  (no money involved; these just predate fulfilledAt/fulfilmentSource)");

    console.log(`\n=== 3. ABANDONED — no captured payment: ${abandoned.length} ===`);
    console.log("  (normal: checkout opened, never paid)");

    if (failed.length) {
        console.log(`\n=== Could not check with Razorpay: ${failed.length} ===`);
        for (const { order, reason } of failed) {
            console.log(`  ${order.razorpayOrder_id}: ${reason}`);
        }
    }

    if (!APPLY) {
        console.log(
            `\nDRY RUN — nothing changed. ` +
            `${lost.length} order(s) would be fulfilled, ${backfill.length} backfilled.`
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

    console.log(`\nFulfilled ${fulfilledCount} lost order(s); backfilled ${backfilledCount}.`);
    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error("Reconciliation failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
