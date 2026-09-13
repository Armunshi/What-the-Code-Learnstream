// Merges `userstudents` and `userteachers` into the single `users` collection
// behind src/models/user.model.js (BACKEND_AUDIT.md §5.4, module B5.6).
//
//   node scripts/migrate-users-to-single-collection.js            # dry run
//   node scripts/migrate-users-to-single-collection.js --apply    # write
//
// What it does, and why each part matters:
//
// * **_id values are preserved exactly.** Courses reference authors and
//   enrolled students by _id, as do Orders, Progress, Cart and every
//   assignment submission. Generating new ids would silently orphan all of it.
//   Every reference keeps working because every _id is carried over unchanged.
//
// * **Emails are lowercased and trimmed**, because the unified model declares
//   `lowercase: true` and its unique index is therefore case-insensitive in
//   effect. Five addresses in this database are not already normalised.
//
// * **Passwords are copied as stored.** They are already bcrypt hashes; the
//   model's pre-save hook would hash them a second time and lock everyone out,
//   so this writes through the driver, not through Mongoose documents.
//
// * **refreshToken is dropped for everyone.** Sessions cannot survive: old
//   tokens carry no `role` claim, and the middleware that used to resolve a
//   role by collection no longer exists. Everyone is logged out by design.
//
// * **Two accounts are deleted.** One email exists as both a student and a
//   teacher in two cases, byte-identical, which a unique email index cannot
//   hold. Both teacher sides own zero courses, so dropping them loses a login
//   and nothing else. This is a decision that was made explicitly, not a
//   heuristic — the ids are listed below and the script refuses to run if what
//   it finds does not match what it expects.
//
// The source collections are left in place. Nothing here is destructive to
// them, so a bad outcome is recoverable by dropping `users` and re-running.
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { DB_NAME } from "../src/constants.js";

const APPLY = process.argv.includes("--apply");
const MIGRATION_NAME = "users-to-single-collection";

// Cross-collection duplicates resolved by deleting the teacher side. Recorded
// as data so the script can verify the database still looks like this.
const DELETE_TEACHERS_WITH_EMAIL = ["12@12.com", "Prajyot@n.com"];

const normaliseEmail = (email) => (email ?? "").trim().toLowerCase();

async function main() {
    await mongoose.connect(`${env.mongodbUri}/${DB_NAME}`);
    const db = mongoose.connection.db;

    const migrations = db.collection("migrations");
    const already = await migrations.findOne({ name: MIGRATION_NAME });
    if (already) {
        console.log(`Already applied on ${already.appliedAt.toISOString()}. Nothing to do.`);
        console.log("Drop the `users` collection and this marker to re-run.");
        return;
    }

    const students = await db.collection("userstudents").find({}).toArray();
    const teachers = await db.collection("userteachers").find({}).toArray();
    console.log(`source: ${students.length} students + ${teachers.length} teachers = ${students.length + teachers.length}`);

    // --- verify the duplicates are still what we decided about ---
    const drop = new Set();
    for (const email of DELETE_TEACHERS_WITH_EMAIL) {
        const key = normaliseEmail(email);
        const teacher = teachers.find((t) => normaliseEmail(t.email) === key);
        const student = students.find((s) => normaliseEmail(s.email) === key);

        if (!teacher || !student) {
            throw new Error(
                `Expected ${email} to exist as BOTH a student and a teacher, but found ` +
                `student=${Boolean(student)} teacher=${Boolean(teacher)}. The database has ` +
                `changed since this was decided — re-check before running.`
            );
        }
        if (teacher.Courses?.length) {
            throw new Error(
                `Teacher ${email} now owns ${teacher.Courses.length} course(s). It was chosen ` +
                `for deletion because it owned none. Refusing to delete content.`
            );
        }
        drop.add(teacher._id.toString());
        console.log(`  will delete teacher ${JSON.stringify(teacher.name)} <${teacher.email}> (0 courses)`);
    }

    // --- build the unified rows ---
    const rows = [];
    const seen = new Map();
    for (const [role, source] of [["student", students], ["teacher", teachers]]) {
        for (const doc of source) {
            if (drop.has(doc._id.toString())) continue;

            const email = normaliseEmail(doc.email);
            if (seen.has(email)) {
                throw new Error(
                    `Unresolved duplicate email ${email}: ${seen.get(email)} and ${role}. ` +
                    `A unique index cannot hold both — resolve it before migrating.`
                );
            }
            seen.set(email, role);

            rows.push({
                _id: doc._id, // preserved — every foreign key depends on it
                name: doc.name,
                email,
                password: doc.password, // already a bcrypt hash; do NOT re-hash
                role,
                ...(doc.avatar ? { avatar: doc.avatar } : {}),
                ...(doc.coverImage ? { coverImage: doc.coverImage } : {}),
                Courses: doc.Courses ?? [],
                // refreshToken deliberately omitted — see the header.
                createdAt: doc.createdAt ?? new Date(),
                updatedAt: new Date(),
            });
        }
    }

    const renamed = rows.filter((r) => {
        const original = [...students, ...teachers].find((d) => d._id.equals(r._id));
        return original.email !== r.email;
    });

    console.log(`\nresult: ${rows.length} users (${rows.filter((r) => r.role === "student").length} students, ${rows.filter((r) => r.role === "teacher").length} teachers)`);
    console.log(`deleted: ${drop.size} duplicate teacher account(s)`);
    console.log(`email normalised: ${renamed.length}`);
    for (const r of renamed) console.log(`  -> ${r.email}`);
    const withSession = [...students, ...teachers].filter((d) => d.refreshToken).length;
    console.log(`sessions invalidated: ${withSession}`);

    if (!APPLY) {
        console.log("\nDRY RUN — nothing written. Re-run with --apply to migrate.");
        return;
    }

    const existing = await db.listCollections({ name: "users" }).toArray();
    if (existing.length) {
        const count = await db.collection("users").countDocuments();
        if (count > 0) {
            throw new Error(`\`users\` already exists with ${count} documents. Refusing to overwrite.`);
        }
    }

    await db.collection("users").insertMany(rows, { ordered: true });
    await db.collection("users").createIndex({ email: 1 }, { unique: true });
    await db.collection("users").createIndex({ role: 1 });

    await migrations.insertOne({
        name: MIGRATION_NAME,
        appliedAt: new Date(),
        migrated: rows.length,
        deletedDuplicateTeachers: [...drop],
        emailsNormalised: renamed.map((r) => r.email),
        sessionsInvalidated: withSession,
    });

    console.log(`\nAPPLIED — ${rows.length} users written, unique index on email created.`);
    console.log("Source collections userstudents/userteachers left untouched.");
}

main()
    .catch((error) => {
        console.error("\nMIGRATION FAILED:", error.message);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
