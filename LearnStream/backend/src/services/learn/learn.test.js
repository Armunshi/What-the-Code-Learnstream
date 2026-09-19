import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../app.js";
import { Sections } from "../../models/section.model.js";
import { VideoItem, ArticleItem, AssignmentItem, ResourceItem } from "../../models/curriculumItem.model.js";
import { WatchPosition } from "../../models/watchPosition.model.js";
import { Progress } from "../../models/progress.model.js";
import { Assignments } from "../../models/assignment.model.js";
import { createTeacher, createStudent, createCourse, enrollStudent, authHeader } from "../../../tests/helpers.js";
import { markItemComplete } from "./progress.service.js";
import { recordPosition, touchItemAccess } from "./watch.service.js";
import { completeItem } from "./completion.service.js";

// This test file lives under services/learn/** (docs/lanes/learn.json's
// "owns" glob) rather than backend/tests/, which LEARN does not own — the
// lane-ownership check (e2e/scripts/check-lane-ownership.mjs) fails on any
// changed file outside the manifest, and vitest.config.js has no `include`
// override, so a test file placed anywhere under src/ still runs.

async function setupCourseWithVideo({ durationSec = 100 } = {}) {
    const teacher = await createTeacher();
    const student = await createStudent();
    const course = await createCourse(teacher);
    await enrollStudent(student, course);
    const section = await Sections.create({ course: course._id, title: "S1", order: 0 });
    const video = await VideoItem.create({ course: course._id, section: section._id, title: "V1", order: 0, durationSec });
    return { teacher, student, course, section, video };
}

describe("services/learn — markItemComplete / percentComplete (D5)", () => {
    it("is idempotent and only counts countable types (video, article, quiz, assignment) toward percentComplete", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await createCourse(teacher);
        await enrollStudent(student, course);
        const section = await Sections.create({ course: course._id, title: "S1", order: 0 });

        const video = await VideoItem.create({ course: course._id, section: section._id, title: "V1", order: 0 });
        await ArticleItem.create({ course: course._id, section: section._id, title: "A1", order: 1 });
        await ResourceItem.create({ course: course._id, section: section._id, title: "R1", order: 2 });
        // Total countable = 2 (video + article) — the resource never counts.

        await markItemComplete({ studentId: student._id, courseId: course._id, itemId: video._id });
        let progress = await Progress.findOne({ studentId: student._id, courseId: course._id });
        expect(progress.completedItems.map(String)).toEqual([String(video._id)]);
        expect(progress.percentComplete).toBeCloseTo(50, 5);
        expect(progress.completedAt).toBeNull();

        // Calling again for the same item must not push a second entry.
        await markItemComplete({ studentId: student._id, courseId: course._id, itemId: video._id });
        progress = await Progress.findOne({ studentId: student._id, courseId: course._id });
        expect(progress.completedItems).toHaveLength(1);
        expect(progress.percentComplete).toBeCloseTo(50, 5);
    });

    it("sets completedAt once every countable item is complete", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await createCourse(teacher);
        await enrollStudent(student, course);
        const section = await Sections.create({ course: course._id, title: "S1", order: 0 });
        const video = await VideoItem.create({ course: course._id, section: section._id, title: "V1", order: 0 });

        await markItemComplete({ studentId: student._id, courseId: course._id, itemId: video._id });
        const progress = await Progress.findOne({ studentId: student._id, courseId: course._id });
        expect(progress.percentComplete).toBeCloseTo(100, 5);
        expect(progress.completedAt).not.toBeNull();
    });
});

describe("services/learn — recordPosition delta cap and 90% auto-completion (L-FR-4.1)", () => {
    it("caps a reported delta to elapsed wall-clock time x playbackRate — seeking to the end does not complete it", async () => {
        const { student, course, video } = await setupCourseWithVideo({ durationSec: 100 });

        await touchItemAccess({ studentId: student._id, courseId: course._id, itemId: video._id });
        // Immediately after opening the item (no real elapsed time), claim
        // to have watched 95s in one heartbeat — a seek-to-the-end cheat.
        const result = await recordPosition({
            studentId: student._id,
            courseId: course._id,
            itemId: video._id,
            positionSec: 95,
            watchedDeltaSec: 95,
            playbackRate: 1,
        });

        expect(result.completed).toBe(false);
        expect(result.watchedSec).toBeLessThan(5); // capped to ~0 elapsed seconds
    });

    it("credits a delta within the elapsed-time cap and auto-completes at >=90% watched", async () => {
        const { student, course, video } = await setupCourseWithVideo({ durationSec: 10 });

        await WatchPosition.create({
            student: student._id,
            course: course._id,
            item: video._id,
            watchedSec: 0,
            positionSec: 0,
            lastHeartbeatAt: new Date(Date.now() - 20_000), // 20s of real elapsed time
        });

        const result = await recordPosition({
            studentId: student._id,
            courseId: course._id,
            itemId: video._id,
            positionSec: 9.5,
            watchedDeltaSec: 9.5, // within the 20s x 1x cap
            playbackRate: 1,
        });

        expect(result.watchedSec).toBeCloseTo(9.5, 3);
        expect(result.completed).toBe(true);

        const progress = await Progress.findOne({ studentId: student._id, courseId: course._id });
        expect(progress.completedItems.map(String)).toContain(String(video._id));
    });

    it("rejects a position write for a non-video item", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await createCourse(teacher);
        await enrollStudent(student, course);
        const section = await Sections.create({ course: course._id, title: "S1", order: 0 });
        const article = await ArticleItem.create({ course: course._id, section: section._id, title: "A1", order: 0 });

        await expect(
            recordPosition({ studentId: student._id, courseId: course._id, itemId: article._id, positionSec: 1, watchedDeltaSec: 1, playbackRate: 1 })
        ).rejects.toMatchObject({ statusCode: 400 });
    });
});

describe("services/learn — completeItem completion rules per content type (D5)", () => {
    it("refuses to complete a video item directly (only auto-completion from watch progress applies)", async () => {
        const { student, course, video } = await setupCourseWithVideo();
        await expect(completeItem({ studentId: student._id, courseId: course._id, itemId: video._id })).rejects.toMatchObject({
            statusCode: 400,
        });
    });

    it("completes an article with no extra verification", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await createCourse(teacher);
        await enrollStudent(student, course);
        const section = await Sections.create({ course: course._id, title: "S1", order: 0 });
        const article = await ArticleItem.create({ course: course._id, section: section._id, title: "A1", order: 0 });

        await completeItem({ studentId: student._id, courseId: course._id, itemId: article._id });
        const progress = await Progress.findOne({ studentId: student._id, courseId: course._id });
        expect(progress.completedItems.map(String)).toContain(String(article._id));
    });

    it("refuses to complete an assignment with no submission, and allows it once one exists", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await createCourse(teacher);
        await enrollStudent(student, course);
        const section = await Sections.create({ course: course._id, title: "S1", order: 0 });
        const assignmentDoc = await Assignments.create({ module_id: section._id, title: "Homework" });
        const assignmentItem = await AssignmentItem.create({
            course: course._id,
            section: section._id,
            title: "Homework",
            order: 0,
            assignment: assignmentDoc._id,
        });

        await expect(
            completeItem({ studentId: student._id, courseId: course._id, itemId: assignmentItem._id })
        ).rejects.toMatchObject({ statusCode: 400 });

        assignmentDoc.uploadedAssignments.push({ studentId: student._id, submittedAssignmentUrls: ["https://example.com/a.pdf"] });
        await assignmentDoc.save();

        await completeItem({ studentId: student._id, courseId: course._id, itemId: assignmentItem._id });
        const progress = await Progress.findOne({ studentId: student._id, courseId: course._id });
        expect(progress.completedItems.map(String)).toContain(String(assignmentItem._id));
    });
});

describe("routes/features/learn.routes.js — entitlement and not-found behavior", () => {
    it("403s a student who is not enrolled", async () => {
        const { course } = await setupCourseWithVideo();
        const outsider = await createStudent();

        const res = await request(app).get(`/learn/${course._id}`).set(authHeader(outsider));
        expect(res.status).toBe(403);
    });

    it("404s an item that belongs to a different course", async () => {
        const { teacher, student, course } = await setupCourseWithVideo();
        const otherCourse = await createCourse(teacher);
        const otherSection = await Sections.create({ course: otherCourse._id, title: "S", order: 0 });
        const otherItem = await VideoItem.create({ course: otherCourse._id, section: otherSection._id, title: "V", order: 0 });

        const res = await request(app).get(`/learn/${course._id}/items/${otherItem._id}`).set(authHeader(student));
        expect(res.status).toBe(404);
    });

    it("blocks the owning teacher from the mutating endpoints — the owner never writes progress", async () => {
        const { teacher, course, video } = await setupCourseWithVideo();

        const positionRes = await request(app)
            .put(`/learn/${course._id}/items/${video._id}/position`)
            .set(authHeader(teacher))
            .send({ positionSec: 1, watchedDeltaSec: 1, playbackRate: 1 });
        expect(positionRes.status).toBe(403);

        const completeRes = await request(app)
            .post(`/learn/${course._id}/items/${video._id}/complete`)
            .set(authHeader(teacher))
            .send({});
        expect(completeRes.status).toBe(403);

        expect(await Progress.findOne({ courseId: course._id })).toBeNull();
    });

    it("GET /learn/:courseId returns the tree with a resume target and per-item completed flags", async () => {
        const { student, course, video } = await setupCourseWithVideo();

        const res = await request(app).get(`/learn/${course._id}`).set(authHeader(student));
        expect(res.status).toBe(200);
        expect(res.body.data.resume).toEqual({ itemId: String(video._id), positionSec: 0 });
        expect(res.body.data.sections[0].items[0]).toMatchObject({ id: String(video._id), completed: false });
    });
});

describe("routes/features/myLearning.routes.js — GET /users/me/learning", () => {
    it("returns percentComplete for an enrolled course and 403s a teacher", async () => {
        const { teacher, student, course, video } = await setupCourseWithVideo();
        await markItemComplete({ studentId: student._id, courseId: course._id, itemId: video._id });

        const res = await request(app).get("/users/me/learning").set(authHeader(student));
        expect(res.status).toBe(200);
        expect(res.body.data.items).toHaveLength(1);
        expect(res.body.data.items[0]).toMatchObject({ courseId: String(course._id), percentComplete: 100, status: "completed" });
        expect(res.body.data.items[0]).not.toHaveProperty("price");

        const teacherRes = await request(app).get("/users/me/learning").set(authHeader(teacher));
        expect(teacherRes.status).toBe(403);
    });
});
