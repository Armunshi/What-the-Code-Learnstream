// Wave 0 migration (user.model.js additions, docs/contracts/domain-model.md):
// splits each existing user's single `name` field into `firstName`/`lastName`
// on a best-effort basis (split on the first space). `name` itself is left
// untouched — it stays the field every existing query/token/UI reads; this
// only populates the two new fields alongside it.
//
// Best-effort, not perfect: a one-word name ("Cher") gets firstName="Cher",
// lastName="" — there is no reliable way to do better without asking the
// user, and this is demo/test data (no production users exist for this app).
//
// IDEMPOTENT via a `migrations` marker (see migrate-prices-to-paise.js) — a
// second run is a no-op. Also skips any user that already has a firstName
// set (e.g. one who signed up after AUTH's registration flow starts
// collecting first/last name directly), so this never clobbers real input
// with a re-derived guess.
//
// Usage:
//   node scripts/migrate-w0-users-split-names.js            # dry run (default)
//   node scripts/migrate-w0-users-split-names.js --dry-run   # dry run (explicit)
//   node scripts/migrate-w0-users-split-names.js --apply     # actually write

import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import { DB_NAME } from "../src/constants.js";

const APPLY = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
const MIGRATION_ID = "w0-users-split-names";

function splitName(name) {
    const trimmed = String(name ?? "").trim();
    if (!trimmed) return { firstName: "", lastName: "" };
    const spaceIndex = trimmed.indexOf(" ");
    if (spaceIndex === -1) return { firstName: trimmed, lastName: "" };
    return {
        firstName: trimmed.slice(0, spaceIndex),
        lastName: trimmed.slice(spaceIndex + 1).trim(),
    };
}

async function main() {
    await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
    console.log(`Connected. Mode: ${APPLY ? "APPLY (will modify users)" : "DRY RUN (report only)"}`);

    const migrations = mongoose.connection.collection("migrations");
    const already = await migrations.findOne({ _id: MIGRATION_ID });
    if (already) {
        console.log(
            `\nAlready applied at ${already.appliedAt?.toISOString?.() ?? already.appliedAt} ` +
            `(${already.userCount} users). Nothing to do — re-running is a safe no-op.`
        );
        await mongoose.disconnect();
        return;
    }

    const usersCol = mongoose.connection.collection("users");
    const users = await usersCol
        .find({ firstName: { $exists: false } })
        .project({ name: 1 })
        .toArray();

    console.log(`\nUsers without firstName: ${users.length}`);

    const ops = users.map((user) => {
        const { firstName, lastName } = splitName(user.name);
        return {
            updateOne: {
                filter: { _id: user._id },
                update: { $set: { firstName, lastName } },
            },
        };
    });

    ops.forEach(({ updateOne }, i) => {
        console.log(`  "${users[i].name}" → firstName=${JSON.stringify(updateOne.update.$set.firstName)} lastName=${JSON.stringify(updateOne.update.$set.lastName)}`);
    });

    if (!APPLY) {
        console.log(`\nDRY RUN — nothing changed. ${ops.length} user(s) would be updated.`);
        await mongoose.disconnect();
        return;
    }

    if (ops.length) {
        const result = await usersCol.bulkWrite(ops);
        console.log(`\nModified ${result.modifiedCount} of ${ops.length} users.`);
    } else {
        console.log("\nNo users to update.");
    }

    await migrations.insertOne({
        _id: MIGRATION_ID,
        appliedAt: new Date(),
        userCount: ops.length,
        note: "user.model.js additions — best-effort name split into firstName/lastName",
    });

    console.log(`\nRecorded migration marker "${MIGRATION_ID}". Re-runs are now a no-op.`);
    await mongoose.disconnect();
}

main().catch(async (err) => {
    console.error("Migration failed:", err);
    await mongoose.disconnect();
    process.exit(1);
});
