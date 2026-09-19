import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { Courses } from "../../src/models/course.model.js";
import { createTeacher, createStudent, createCourse, enrollStudent, authHeader } from "../helpers.js";

// Coverage for plan W1-SHELL's backend endpoints (docs/lanes/shell.json):
// GET/POST /instructor/courses, GET/DELETE /instructor/courses/:courseId,
// PATCH …/learners (editVersion-guarded), GET …/readiness, POST
// …/publish|unpublish. The three required regressions named in the plan
// ("non-owner 403; stale editVersion 409; publish 422 until the rules
// pass") each get their own test below rather than being folded into a
// happy-path test, so a future regression here fails with an unambiguous
// name.

describe("POST /instructor/courses", () => {
    it("creates a DRAFT course from a title alone", async () => {
        const teacher = await createTeacher();

        const res = await request(app)
            .post("/instructor/courses")
            .set(authHeader(teacher))
            .send({ title: "My New Course" });

        expect(res.status).toBe(201);
        expect(res.body.data.course.title).toBe("My New Course");
        expect(res.body.data.course.status).toBe("DRAFT");
        expect(res.body.data.course.author).toBe(String(teacher._id));
    });

    it("400s a duplicate title for the same author", async () => {
        const teacher = await createTeacher();
        await request(app).post("/instructor/courses").set(authHeader(teacher)).send({ title: "Dup" });

        const res = await request(app).post("/instructor/courses").set(authHeader(teacher)).send({ title: "Dup" });
        expect(res.status).toBe(400);
    });

    it("403s a student", async () => {
        const student = await createStudent();
        const res = await request(app)
            .post("/instructor/courses")
            .set(authHeader(student))
            .send({ title: "Nope" });
        expect(res.status).toBe(403);
    });
});

describe("GET /instructor/courses", () => {
    it("lists only the caller's own courses", async () => {
        const teacherA = await createTeacher();
        const teacherB = await createTeacher();
        await createCourse(teacherA, { title: "A's course" });
        await createCourse(teacherB, { title: "B's course" });

        const res = await request(app).get("/instructor/courses").set(authHeader(teacherA));
        expect(res.status).toBe(200);
        expect(res.body.data.items).toHaveLength(1);
        expect(res.body.data.items[0].title).toBe("A's course");
    });
});

describe("GET/DELETE /instructor/courses/:courseId — ownership", () => {
    it("404s a course that doesn't exist", async () => {
        const teacher = await createTeacher();
        const res = await request(app)
            .get(`/instructor/courses/${teacher._id}`) // any valid-looking ObjectId with no matching course
            .set(authHeader(teacher));
        expect(res.status).toBe(404);
    });

    it("403s a teacher who doesn't own the course", async () => {
        const owner = await createTeacher();
        const outsider = await createTeacher();
        const course = await createCourse(owner);

        const res = await request(app).get(`/instructor/courses/${course._id}`).set(authHeader(outsider));
        expect(res.status).toBe(403);
    });

    it("deletes a DRAFT with no enrollments", async () => {
        const teacher = await createTeacher();
        const course = await createCourse(teacher);

        const res = await request(app).delete(`/instructor/courses/${course._id}`).set(authHeader(teacher));
        expect(res.status).toBe(200);
        expect(await Courses.findById(course._id)).toBeNull();
    });

    it("400s deleting a course with enrolled students", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await createCourse(teacher);
        await enrollStudent(student, course);

        const res = await request(app).delete(`/instructor/courses/${course._id}`).set(authHeader(teacher));
        expect(res.status).toBe(400);
        expect(await Courses.findById(course._id)).not.toBeNull();
    });

    it("403s a non-owner's delete attempt rather than deleting or 404ing", async () => {
        const owner = await createTeacher();
        const outsider = await createTeacher();
        const course = await createCourse(owner);

        const res = await request(app).delete(`/instructor/courses/${course._id}`).set(authHeader(outsider));
        expect(res.status).toBe(403);
        expect(await Courses.findById(course._id)).not.toBeNull();
    });
});

describe("PATCH /instructor/courses/:courseId/learners", () => {
    it("updates learners fields and bumps editVersion", async () => {
        const teacher = await createTeacher();
        const course = await createCourse(teacher);

        const res = await request(app)
            .patch(`/instructor/courses/${course._id}/learners`)
            .set(authHeader(teacher))
            .send({
                editVersion: 0,
                learningObjectives: ["Build a REST API"],
                requirements: [],
                noPrerequisites: true,
                targetAudience: ["Beginners"],
            });

        expect(res.status).toBe(200);
        expect(res.body.data.course.learningObjectives).toEqual(["Build a REST API"]);
        expect(res.body.data.course.editVersion).toBe(1);
    });

    it("409s a stale editVersion and returns the current document", async () => {
        const teacher = await createTeacher();
        const course = await createCourse(teacher);

        await request(app)
            .patch(`/instructor/courses/${course._id}/learners`)
            .set(authHeader(teacher))
            .send({ editVersion: 0, learningObjectives: ["First save"] });

        // Retrying with the now-stale editVersion: 0 (the caller never saw the
        // bump) must conflict, not silently overwrite the first save.
        const res = await request(app)
            .patch(`/instructor/courses/${course._id}/learners`)
            .set(authHeader(teacher))
            .send({ editVersion: 0, learningObjectives: ["Second save, stale"] });

        expect(res.status).toBe(409);
        expect(res.body.code).toBe("VERSION_CONFLICT");
        expect(res.body.current.learningObjectives).toEqual(["First save"]);
        expect(res.body.current.editVersion).toBe(1);
    });

    it("403s a non-owner's write instead of a version conflict", async () => {
        const owner = await createTeacher();
        const outsider = await createTeacher();
        const course = await createCourse(owner);

        const res = await request(app)
            .patch(`/instructor/courses/${course._id}/learners`)
            .set(authHeader(outsider))
            .send({ editVersion: 0, learningObjectives: ["Hijack"] });

        expect(res.status).toBe(403);
    });
});

describe("GET /instructor/courses/:courseId/readiness", () => {
    it("reports the learners rule as failing until an objective is added", async () => {
        const teacher = await createTeacher();
        const course = await createCourse(teacher);

        const before = await request(app).get(`/instructor/courses/${course._id}/readiness`).set(authHeader(teacher));
        expect(before.status).toBe(200);
        expect(before.body.data.percent).toBeLessThan(100);
        const learnersItem = before.body.data.required.find((item) => item.key === "learningObjectives");
        expect(learnersItem.met).toBe(false);

        await request(app)
            .patch(`/instructor/courses/${course._id}/learners`)
            .set(authHeader(teacher))
            .send({ editVersion: 0, learningObjectives: ["Ship a project"] });

        const after = await request(app).get(`/instructor/courses/${course._id}/readiness`).set(authHeader(teacher));
        expect(after.body.data.percent).toBe(100);
        expect(after.body.data.steps.learners.complete).toBe(true);
    });
});

describe("POST /instructor/courses/:courseId/publish", () => {
    it("422s with the failing required rules until readiness passes", async () => {
        const teacher = await createTeacher();
        const course = await createCourse(teacher);

        const res = await request(app).post(`/instructor/courses/${course._id}/publish`).set(authHeader(teacher));
        expect(res.status).toBe(422);
        expect(res.body.code).toBe("NOT_READY");
        expect(res.body.required.some((item) => item.key === "learningObjectives")).toBe(true);
        expect(await Courses.findById(course._id)).toMatchObject({ status: "DRAFT" });
    });

    it("publishes once every required rule passes", async () => {
        const teacher = await createTeacher();
        const course = await createCourse(teacher);
        await request(app)
            .patch(`/instructor/courses/${course._id}/learners`)
            .set(authHeader(teacher))
            .send({ editVersion: 0, learningObjectives: ["Ship a project"] });

        const res = await request(app).post(`/instructor/courses/${course._id}/publish`).set(authHeader(teacher));
        expect(res.status).toBe(200);
        expect(res.body.data.course.status).toBe("PUBLISHED");
        expect(res.body.data.course.publishedAt).toBeTruthy();
    });

    it("403s a non-owner's publish attempt", async () => {
        const owner = await createTeacher();
        const outsider = await createTeacher();
        const course = await createCourse(owner);

        const res = await request(app).post(`/instructor/courses/${course._id}/publish`).set(authHeader(outsider));
        expect(res.status).toBe(403);
    });
});

describe("POST /instructor/courses/:courseId/unpublish", () => {
    it("moves a PUBLISHED course back to DRAFT", async () => {
        const teacher = await createTeacher();
        const course = await createCourse(teacher);
        course.status = "PUBLISHED";
        course.publishedAt = new Date();
        await course.save();

        const res = await request(app).post(`/instructor/courses/${course._id}/unpublish`).set(authHeader(teacher));
        expect(res.status).toBe(200);
        expect(res.body.data.course.status).toBe("DRAFT");
    });
});
