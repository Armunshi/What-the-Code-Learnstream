import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, "../..");
const SCRIPT_PATH = path.resolve(BACKEND_ROOT, "scripts/migrate-w0-curriculum-v2.js");

// Runs the REAL migration script (not a refactored copy of its logic) as a
// separate `node` subprocess against the same mongodb-memory-server instance
// this test file's own mongoose connection is already using — but a
// DIFFERENT database within it (the script always connects to
// `${MONGODB_URI}/${DB_NAME}` — src/constants.js's DB_NAME, "learnstreamdb"
// — regardless of what this test's shared connection happens to be using).
// That keeps this test from ever touching the shared connection every other
// regression test in this run also depends on (tests/setup.js's afterEach
// wipes ITS database's collections between tests, not this one).
describe("W0-B migration — migrate-w0-curriculum-v2.js", () => {
    it("preserves _ids and order, and is idempotent across two --apply runs", async () => {
        const { host, port } = mongoose.connection;
        const baseUri = `mongodb://${host}:${port}`;
        const db = mongoose.connection.useDb("learnstreamdb", { useCache: true });

        const courseId = new mongoose.Types.ObjectId();
        const moduleId = new mongoose.Types.ObjectId();
        const lecture1Id = new mongoose.Types.ObjectId();
        const lecture2Id = new mongoose.Types.ObjectId();
        const assignmentId = new mongoose.Types.ObjectId();
        const authorId = new mongoose.Types.ObjectId();

        // Seeded as raw documents (not through the Sections/CurriculumItems
        // models) to faithfully represent the PRE-migration shape: a course
        // with one module holding two lectures (in order) and one assignment.
        await db.collection("modules").insertOne({
            _id: moduleId,
            title: "Section A",
            course: courseId,
            lectures: [lecture1Id, lecture2Id],
            assignments: [assignmentId],
        });
        await db.collection("lectures").insertMany([
            { _id: lecture1Id, title: "L1", videourl: "https://x/1.mp4", duration: 100, public_id: "p1", module_id: moduleId },
            { _id: lecture2Id, title: "L2", videourl: "https://x/2.mp4", duration: 200, public_id: "p2", module_id: moduleId },
        ]);
        await db.collection("assignments").insertOne({
            _id: assignmentId,
            title: "A1",
            module_id: moduleId,
            public_id: [],
            resourceTypes: [],
            assignmentUrls: [],
        });
        await db.collection("courses").insertOne({
            _id: courseId,
            title: "Course",
            description: "d",
            price: 0,
            author: authorId,
            category: "General",
            modules: [moduleId],
        });

        const env = { ...process.env, MONGODB_URI: baseUri };
        const run = () => execFileSync("node", [SCRIPT_PATH, "--apply"], { cwd: BACKEND_ROOT, env, stdio: "pipe" });

        run();

        const items = await db.collection("curriculumitems").find({ course: courseId }).sort({ order: 1 }).toArray();
        expect(items).toHaveLength(3);

        // _ids preserved: each CurriculumItem is the SAME _id as the
        // Lecture/Assignment document it was built from.
        expect(items[0]._id.toString()).toBe(lecture1Id.toString());
        expect(items[0].type).toBe("video");
        expect(items[0].order).toBe(0);

        expect(items[1]._id.toString()).toBe(lecture2Id.toString());
        expect(items[1].type).toBe("video");
        expect(items[1].order).toBe(1);

        // Assignment appended after both lectures, in the same section.
        expect(items[2]._id.toString()).toBe(assignmentId.toString());
        expect(items[2].type).toBe("assignment");
        expect(items[2].order).toBe(2);

        const section = await db.collection("modules").findOne({ _id: moduleId });
        expect(section.order).toBe(0);

        // Idempotent: a second --apply run is a no-op (the `migrations`
        // marker short-circuits it) — same ids, same order, same count.
        run();

        const itemsAfterSecondRun = await db.collection("curriculumitems").find({ course: courseId }).sort({ order: 1 }).toArray();
        expect(itemsAfterSecondRun).toHaveLength(3);
        expect(itemsAfterSecondRun.map((i) => i._id.toString())).toEqual(items.map((i) => i._id.toString()));
        expect(itemsAfterSecondRun.map((i) => i.order)).toEqual(items.map((i) => i.order));

        // Cleanup: this test's seed data lives in a database
        // (mongoose.connection default) never touches, so tests/setup.js's
        // afterEach wouldn't otherwise clear it for the next test run in
        // this same file/process.
        await db.dropDatabase();
    }, 30000);
});
