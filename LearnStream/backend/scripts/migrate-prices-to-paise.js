// One-off data migration for BACKEND_AUDIT.md §2.7.
//
// Course prices used to be stored as rupees in a plain Number field, so a
// price could be fractional (19.99) and `price * 100` in createOrder produced
// a non-integer paise amount — 19.99 * 100 is 1998.9999999999998 in IEEE-754,
// which Razorpay rejects. Prices are now stored as integer paise instead, and
// the schema validator enforces it.
//
// This script converts every existing course from rupees to paise
// (price → round(price * 100)).
//
// IDEMPOTENCY: running this twice would multiply by 100 twice and silently
// inflate every price 100-fold, so completion is recorded in a `migrations`
// collection and a second run refuses to touch anything. Do not remove that
// guard, and do not "fix" a partial run by re-running with the marker deleted
// without first checking which courses already hold paise.
//
// ORDERING: `orders.amount` was already stored in paise (it was rupees * 100
// at order-creation time), so existing orders stay correct and are not
// touched. But the application code and this migration must land together —
// new code reading un-migrated rupee prices would charge 1/100th of the real
// amount, and old code reading migrated paise prices would charge 100x. Run
// this immediately before or after deploying, not days apart.
//
// Usage:
//   node scripts/migrate-prices-to-paise.js            # dry run (report only)
//   node scripts/migrate-prices-to-paise.js --apply    # actually convert

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { DB_NAME } from "../src/constants.js";

const APPLY = process.argv.includes("--apply");
const MIGRATION_ID = "courses-price-rupees-to-paise";

async function main() {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    console.log(`Connected. Mode: ${APPLY ? "APPLY (will modify prices)" : "DRY RUN (report only)"}`);

    const migrations = mongoose.connection.collection("migrations");
    const already = await migrations.findOne({ _id: MIGRATION_ID });

    if (already) {
        console.log(
            `\nAlready applied at ${already.appliedAt?.toISOString?.() ?? already.appliedAt} ` +
            `(${already.courseCount} courses converted). Nothing to do.`
        );
        console.log("Re-running would multiply prices by 100 a second time, so this is a hard stop.");
        await mongoose.disconnect();
        return;
    }

    // Read through the driver, not the Mongoose model: the model's new
    // validator only accepts integers, and the whole point here is to read the
    // pre-migration rupee values, some of which may be fractional.
    const courses = mongoose.connection.collection("courses");
    const docs = await courses.find({}).project({ title: 1, price: 1 }).toArray();

    console.log(`\nCourses found: ${docs.length}`);

    const missing = docs.filter((d) => typeof d.price !== "number" || Number.isNaN(d.price));
    const fractional = docs.filter((d) => typeof d.price === "number" && !Number.isInteger(d.price));

    if (missing.length) {
        console.log(`\nCourses with a missing or non-numeric price: ${missing.length}`);
        missing.forEach((d) => console.log(`  ${d._id} "${d.title}" price=${JSON.stringify(d.price)}`));
        console.log("These are skipped — fix them by hand, they cannot be converted safely.");
    }

    console.log(`\nFractional rupee prices (the §2.7 bug in live data): ${fractional.length}`);
    fractional.forEach((d) => console.log(`  ${d._id} "${d.title}" ₹${d.price} → ${Math.round(d.price * 100)} paise`));

    const convertible = docs.filter((d) => typeof d.price === "number" && !Number.isNaN(d.price));

    console.log("\nConversions:");
    convertible.forEach((d) => {
        console.log(`  "${d.title}": ₹${d.price} → ${Math.round(d.price * 100)} paise`);
    });

    if (!APPLY) {
        console.log(`\nDRY RUN — nothing changed. ${convertible.length} courses would be converted.`);
        console.log("Re-run with --apply to perform the migration.");
        await mongoose.disconnect();
        return;
    }

    const ops = convertible.map((d) => ({
        updateOne: {
            filter: { _id: d._id },
            update: { $set: { price: Math.round(d.price * 100) } },
        },
    }));

    if (ops.length) {
        const result = await courses.bulkWrite(ops);
        console.log(`\nModified ${result.modifiedCount} of ${ops.length} courses.`);
    } else {
        console.log("\nNo courses to convert.");
    }

    await migrations.insertOne({
        _id: MIGRATION_ID,
        appliedAt: new Date(),
        courseCount: ops.length,
        skipped: missing.map((d) => d._id),
        note: "BACKEND_AUDIT.md §2.7 — courses.price converted from rupees to integer paise",
    });

    console.log(`Recorded migration marker "${MIGRATION_ID}". Re-runs are now a no-op.`);
    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error("Migration failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
