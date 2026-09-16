import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { Courses } from "../../src/models/course.model.js";
import { createTeacher, createStudent, createCourse, authHeader } from "../helpers.js";

// Coverage for plan W1-COM's D10 free enrollment (docs/contracts/
// api-conventions.md): POST /courses/:courseId/enroll.

const publish = async (course) => {
    course.status = "PUBLISHED";
    course.publishedAt = new Date();
    await course.save();
    return course;
};

describe("POST /courses/:courseId/enroll", () => {
    it("enrolls a student in a published free course", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await publish(await createCourse(teacher, { price: 0 }));

        const res = await request(app).post(`/courses/${course._id}/enroll`).set(authHeader(student));
        expect(res.status).toBe(200);
        expect(res.body.data.redirectTo).toBe(`/learn/${course._id}`);

        const updated = await Courses.findById(course._id);
        expect(updated.enrolledStudents.map(String)).toContain(String(student._id));
    });

    it("is idempotent — enrolling twice succeeds both times with no duplicate", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await publish(await createCourse(teacher, { price: 0 }));

        await request(app).post(`/courses/${course._id}/enroll`).set(authHeader(student));
        const res = await request(app).post(`/courses/${course._id}/enroll`).set(authHeader(student));

        expect(res.status).toBe(200);
        const updated = await Courses.findById(course._id);
        const occurrences = updated.enrolledStudents.filter((id) => id.toString() === String(student._id));
        expect(occurrences).toHaveLength(1);
    });

    it("402s a paid course rather than enrolling for free", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await publish(await createCourse(teacher, { price: 49900 }));

        const res = await request(app).post(`/courses/${course._id}/enroll`).set(authHeader(student));
        expect(res.status).toBe(402);
        expect(res.body.code).toBe("PAYMENT_REQUIRED");

        const updated = await Courses.findById(course._id);
        expect(updated.enrolledStudents).toHaveLength(0);
    });

    it("404s an unpublished (DRAFT) free course", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await createCourse(teacher, { price: 0 }); // left DRAFT

        const res = await request(app).post(`/courses/${course._id}/enroll`).set(authHeader(student));
        expect(res.status).toBe(404);
    });

    it("403s a teacher", async () => {
        const teacher = await createTeacher();
        const course = await publish(await createCourse(teacher, { price: 0 }));

        const res = await request(app).post(`/courses/${course._id}/enroll`).set(authHeader(teacher));
        expect(res.status).toBe(403);
    });
});
