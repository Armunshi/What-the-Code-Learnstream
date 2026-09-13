// Read-only health check for the unified user model (BACKEND_AUDIT.md §5.4).
//
//   node scripts/check-user-invariants.js
//
// Exits non-zero if any invariant is broken, so CI can gate on it.
//
// Why this exists: users used to live in two collections with role implied by
// which one held the _id. That was merged into one `users` collection with an
// explicit `role` field. Nothing in the code can bring the split back on its
// own, but a stray script, a restored backup, or a half-applied migration can
// — and the symptom would be subtle (some users invisible, a login that works
// on one route and not another) rather than an obvious crash. This asserts the
// shape the rest of the backend now assumes.
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { DB_NAME } from "../src/constants.js";

const ROLES = ["student", "teacher"];
const LEGACY = ["userstudents", "userteachers"];

let failures = 0;
const check = (ok, label, detail = "") => {
    if (!ok) failures += 1;
    console.log(`${ok ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

async function main() {
    await mongoose.connect(`${env.mongodbUri}/${DB_NAME}`);
    const db = mongoose.connection.db;
    const names = (await db.listCollections().toArray()).map((c) => c.name);

    // --- the collection itself ---
    check(names.includes("users"), "`users` collection exists");

    // NOT a failure while the deployed build still predates the merge.
    //
    // Production and local share one Atlas database. The deployed code still
    // reads `userstudents`/`userteachers`, so those collections must keep their
    // data until the merge is actually deployed — renaming them away took
    // production login down until they were restored. Worse, the deployed app
    // re-creates them *empty* on boot (Mongoose builds the unique email index
    // at model init, which creates the collection), and an empty `userstudents`
    // is indistinguishable from a missing one to a login: every user 404s.
    //
    // Correct sequence: deploy first, confirm production reads `users`, and
    // only then retire these. Until that happens their presence is expected.
    const live = LEGACY.filter((n) => names.includes(n));
    if (live.length) {
        console.log(
            `warn  legacy collection(s) still live: ${live.join(", ")} — expected until the ` +
            `merge is deployed, since production still reads them. Retire only after deploying.`
        );
    } else {
        check(true, "no legacy user collection remains");
    }

    const users = db.collection("users");
    const total = await users.countDocuments();
    check(total > 0, "`users` is not empty", `${total} users`);

    // --- every user is well-formed ---
    const noRole = await users.countDocuments({ role: { $nin: ROLES } });
    check(noRole === 0, "every user has a valid role", noRole ? `${noRole} without one` : "");

    const noEmail = await users.countDocuments({ $or: [{ email: { $exists: false } }, { email: "" }] });
    check(noEmail === 0, "every user has an email", noEmail ? `${noEmail} without one` : "");

    const noPassword = await users.countDocuments({ $or: [{ password: { $exists: false } }, { password: "" }] });
    check(noPassword === 0, "every user has a password", noPassword ? `${noPassword} without one` : "");

    // --- email is the identity, so it must behave like one ---
    const indexes = await users.indexes();
    const emailIndex = indexes.find((i) => i.key?.email === 1);
    check(Boolean(emailIndex?.unique), "unique index on email");

    const dupes = await users
        .aggregate([{ $group: { _id: "$email", n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }])
        .toArray();
    check(dupes.length === 0, "no duplicate emails", dupes.map((d) => d._id).join(", "));

    const mixedCase = (await users.find({}).project({ email: 1 }).toArray())
        .filter((u) => u.email !== u.email.trim().toLowerCase());
    check(
        mixedCase.length === 0,
        "every email is lowercase and trimmed",
        mixedCase.map((u) => u.email).join(", ")
    );

    // --- foreign keys, which only work because _ids were preserved ---
    const ids = new Set((await users.find({}).project({ _id: 1 }).toArray()).map((u) => u._id.toString()));
    const teacherIds = new Set(
        (await users.find({ role: "teacher" }).project({ _id: 1 }).toArray()).map((u) => u._id.toString())
    );

    const courses = await db.collection("courses").find({}).project({ title: 1, author: 1, enrolledStudents: 1 }).toArray();
    const badAuthors = courses.filter((c) => !teacherIds.has(c.author?.toString()));
    check(
        badAuthors.length === 0,
        "every course author resolves to a teacher",
        badAuthors.map((c) => c.title).join(", ")
    );

    const orphanEnrolments = courses.flatMap((c) =>
        (c.enrolledStudents ?? [])
            .filter((id) => !ids.has(id.toString()))
            .map((id) => `${c.title}:${id}`)
    );
    check(
        orphanEnrolments.length === 0,
        "every enrolledStudents id resolves to a user",
        orphanEnrolments.join(", ")
    );

    const orders = await db.collection("orders").find({}).project({ user_id: 1 }).toArray();
    const orphanOrders = orders.filter((o) => !ids.has(o.user_id?.toString()));
    check(orphanOrders.length === 0, "every order user_id resolves to a user", `${orphanOrders.length} dangling`);

    console.log(failures === 0 ? "\nAll invariants hold." : `\n${failures} invariant(s) BROKEN.`);
    process.exitCode = failures === 0 ? 0 : 1;
}

main()
    .catch((error) => {
        console.error("check failed to run:", error.message);
        process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
