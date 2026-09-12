// Regression proof for the bulk module-create endpoint (BACKEND_AUDIT.md
// §3.20): a multi-module submission with lectures and assignments must
// succeed completely or fail completely, never partially.
//
//   node scripts/verify-bulk-module-atomicity.js
//
// Requires the backend running locally on :8000 (node src/index.js).
// Creates a real throwaway teacher + course against MONGODB_URI, exercises
// both a valid submission and a deliberately-failing one, checks the
// database directly rather than trusting the HTTP response alone, and
// deletes everything it created afterward — success or failure.
//
// The failure case is not synthetic: it reuses createAssignment's own
// existing duplicate-title-within-a-module check (a 409, thrown before any
// write for that item) to force a failure partway through a module that
// already has a successfully-created lecture and first assignment, and then
// asserts every one of those is gone — not just unlinked from its parent,
// but the underlying documents themselves.
import fs from "node:fs";
import mongoose from "mongoose";
import { env } from "../src/config/env.js";
import { DB_NAME } from "../src/constants.js";

const BASE = "http://localhost:8000";
const LECTURE_FILE = new URL("../../e2e/fixtures/assets/placeholder-lecture.mp4", import.meta.url);

// A minimal, valid, byte-small PDF — Cloudinary's resource_type:"auto" only
// needs something it can recognise, not a real document.
const MINIMAL_PDF = Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n" +
    "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\nxref\n0 4\n0000000000 65535 f \n" +
    "trailer<</Size 4/Root 1 0 R>>\n%%EOF"
);

const lectureBlob = () => new Blob([fs.readFileSync(LECTURE_FILE)], { type: "video/mp4" });
const pdfBlob = () => new Blob([MINIMAL_PDF], { type: "application/pdf" });

let failures = 0;
const check = (label, cond, detail = "") => {
    console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
    if (!cond) failures += 1;
};

async function main() {
    await mongoose.connect(`${env.mongodbUri}/${DB_NAME}`);
    const db = mongoose.connection.db;

    const runId = Date.now();
    const email = `bulk-atomicity-check-${runId}@example.com`;

    const signup = await fetch(`${BASE}/user/teacher/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `BulkAtomicityCheck${runId}`, email, password: "correcthorsebattery" }),
    }).then((r) => r.json());
    const token = signup?.data?.accessToken;
    if (!token) throw new Error(`teacher signup failed: ${JSON.stringify(signup)}`);

    const courseForm = new FormData();
    courseForm.append("title", `Bulk Atomicity Check ${runId}`);
    courseForm.append("description", "automated atomicity check — safe to delete");
    courseForm.append("price", "0");
    courseForm.append("category", "Test");
    courseForm.append("thumbnail", pdfBlob(), "thumb.pdf");
    const courseRes = await fetch(`${BASE}/courses/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: courseForm,
    }).then((r) => r.json());
    const courseId = courseRes?.data?._id;
    if (!courseId) throw new Error(`course create failed: ${JSON.stringify(courseRes)}`);

    // ---------------------------------------------------------------------
    // Scenario 1: a fully valid 2-module submission must fully succeed.
    // ---------------------------------------------------------------------
    const structure1 = [
        { title: "Module A", lectures: [{ title: "A Lecture 1" }], assignments: [{ title: "A Assignment 1" }] },
        { title: "Module B", lectures: [{ title: "B Lecture 1" }], assignments: [{ title: "B Assignment 1" }] },
    ];
    const form1 = new FormData();
    form1.append("structure", JSON.stringify(structure1));
    form1.append("module_0_lecture_0", lectureBlob(), "a.mp4");
    form1.append("module_0_assignment_0_file_0", pdfBlob(), "a.pdf");
    form1.append("module_1_lecture_0", lectureBlob(), "b.mp4");
    form1.append("module_1_assignment_0_file_0", pdfBlob(), "b.pdf");

    const res1 = await fetch(`${BASE}/courses/${courseId}/modules/bulk`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form1,
    });
    const body1 = await res1.json();
    check("valid submission: HTTP 200", res1.status === 200, `got ${res1.status}: ${body1.message}`);

    const courseAfter1 = await db.collection("courses").findOne({ _id: new mongoose.Types.ObjectId(courseId) });
    check("valid submission: 2 modules linked", courseAfter1.modules.length === 2, `got ${courseAfter1.modules.length}`);
    check("valid submission: 2 lectures linked", courseAfter1.lectures.length === 2, `got ${courseAfter1.lectures.length}`);

    // ---------------------------------------------------------------------
    // Scenario 2: a module whose second assignment collides on title with
    // its first must roll back completely — the module, its lecture, and
    // its first (already-created) assignment all disappear.
    // ---------------------------------------------------------------------
    const failingTitle = `Duplicate ${runId}`;
    const structure2 = [
        {
            title: `Module C ${runId}`,
            lectures: [{ title: `C Lecture ${runId}` }],
            assignments: [{ title: failingTitle }, { title: failingTitle }],
        },
    ];
    const form2 = new FormData();
    form2.append("structure", JSON.stringify(structure2));
    form2.append("module_0_lecture_0", lectureBlob(), "c.mp4");
    form2.append("module_0_assignment_0_file_0", pdfBlob(), "c1.pdf");
    form2.append("module_0_assignment_1_file_0", pdfBlob(), "c2.pdf");

    const res2 = await fetch(`${BASE}/courses/${courseId}/modules/bulk`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form2,
    });
    const body2 = await res2.json();
    check("failing submission: request rejected", res2.status !== 200, `got ${res2.status}: ${body2.message}`);

    const courseAfter2 = await db.collection("courses").findOne({ _id: new mongoose.Types.ObjectId(courseId) });
    check("rollback: course.modules unchanged", courseAfter2.modules.length === courseAfter1.modules.length);
    check("rollback: course.lectures unchanged", courseAfter2.lectures.length === courseAfter1.lectures.length);
    check("rollback: no orphaned module document", (await db.collection("modules").findOne({ title: `Module C ${runId}` })) === null);
    check("rollback: no orphaned lecture document", (await db.collection("lectures").findOne({ title: `C Lecture ${runId}` })) === null);
    check(
        "rollback: no orphaned assignment document (including the one created before the 2nd collided)",
        (await db.collection("assignments").find({ title: failingTitle }).toArray()).length === 0
    );

    console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);

    // ---- cleanup: delete everything this run created, pass or fail ----
    for (const mid of courseAfter1.modules) {
        const m = await db.collection("modules").findOne({ _id: mid });
        if (m) {
            await db.collection("lectures").deleteMany({ _id: { $in: m.lectures ?? [] } });
            await db.collection("assignments").deleteMany({ _id: { $in: m.assignments ?? [] } });
            await db.collection("modules").deleteOne({ _id: mid });
        }
    }
    await db.collection("courses").deleteOne({ _id: new mongoose.Types.ObjectId(courseId) });
    await db.collection("users").deleteOne({ email });

    await mongoose.disconnect();
    process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
    console.error("check failed to run:", error);
    process.exit(1);
});
