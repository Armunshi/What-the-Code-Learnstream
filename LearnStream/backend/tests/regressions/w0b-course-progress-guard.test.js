import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { VideoItem, AssignmentItem } from "../../src/models/curriculumItem.model.js";
import { Sections } from "../../src/models/section.model.js";
import { Progress } from "../../src/models/progress.model.js";
import { createTeacher, createStudent, createCourse, enrollStudent, authHeader } from "../helpers.js";

// GET /courses/:courseId/progress used to run for ANY authenticated caller —
// enrolled or not — silently answering "0%" instead of signaling they
// aren't entitled to this course at all. Guarded now the same way
// markLectureCompleted/markAssignmentCompleted already guard their own
// routes. Also fixes the percentage computation to count over
// CurriculumItems (video + assignment types) instead of the legacy
// course.lectures/course.assignments arrays, whose assignment count was
// always 0 (BACKEND_AUDIT.md §3.13) and made every course look 100%
// assignment-complete before a single assignment existed.
describe("W0-B — GET /courses/:courseId/progress", () => {
    it("403s a student who is not enrolled in the course", async () => {
        const teacher = await createTeacher();
        const outsider = await createStudent();
        const course = await createCourse(teacher);

        const res = await request(app)
            .get(`/courses/${course._id}/progress`)
            .set(authHeader(outsider));

        expect(res.status).toBe(403);
    });

    it("403s a teacher (this endpoint is student-only)", async () => {
        const teacher = await createTeacher();
        const course = await createCourse(teacher);

        const res = await request(app)
            .get(`/courses/${course._id}/progress`)
            .set(authHeader(teacher));

        expect(res.status).toBe(403);
    });

    it("computes percent over countable CurriculumItems (video + assignment), not the legacy arrays", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await createCourse(teacher);
        await enrollStudent(student, course);

        const section = await Sections.create({ course: course._id, title: "S1", order: 0 });
        const video1 = await VideoItem.create({ course: course._id, section: section._id, title: "L1", order: 0 });
        await VideoItem.create({ course: course._id, section: section._id, title: "L2", order: 1 });
        await AssignmentItem.create({ course: course._id, section: section._id, title: "A1", order: 2 });
        // Total countable = 3 (2 video + 1 assignment). Complete one lecture.

        await Progress.create({
            studentId: student._id,
            courseId: course._id,
            completedLectures: [{ lectureId: video1._id }],
            completedLectureCount: 1,
        });

        const res = await request(app)
            .get(`/courses/${course._id}/progress`)
            .set(authHeader(student));

        expect(res.status).toBe(200);
        expect(res.body.data.totalLectures).toBe(2);
        expect(res.body.data.totalAssignments).toBe(1);
        expect(res.body.data.progressPercentage).toBeCloseTo(100 / 3, 5);
    });
});
