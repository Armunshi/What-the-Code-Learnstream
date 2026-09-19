import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { createTeacher, createStudent, createCourse, enrollStudent, authHeader } from "../helpers.js";

// Coverage for plan W1-COM's cart endpoints (docs/lanes/com.json):
// GET/POST/DELETE /courses/cart(/:courseId), POST /courses/cart/merge.

describe("GET /courses/cart", () => {
    it("200s with an empty list instead of 404 when the student has no cart yet", async () => {
        const student = await createStudent();

        const res = await request(app).get("/courses/cart").set(authHeader(student));
        expect(res.status).toBe(200);
        expect(res.body.data.items).toEqual([]);
    });
});

describe("POST /courses/cart/:courseId", () => {
    it("adds a paid course to the cart", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await createCourse(teacher, { price: 49900 });

        const res = await request(app).post(`/courses/cart/${course._id}`).set(authHeader(student));
        expect(res.status).toBe(200);
        expect(res.body.data.items).toHaveLength(1);
        expect(res.body.data.items[0].id).toBe(String(course._id));
    });

    it("is idempotent — adding the same course twice doesn't duplicate it", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await createCourse(teacher, { price: 49900 });

        await request(app).post(`/courses/cart/${course._id}`).set(authHeader(student));
        const res = await request(app).post(`/courses/cart/${course._id}`).set(authHeader(student));

        expect(res.status).toBe(200);
        expect(res.body.data.items).toHaveLength(1);
    });

    it("404s a course that doesn't exist", async () => {
        const student = await createStudent();

        const res = await request(app).post("/courses/cart/000000000000000000000000").set(authHeader(student));
        expect(res.status).toBe(404);
    });

    it("400s with FREE_COURSE_ENROLL_DIRECTLY for a free course — free courses never enter a cart", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await createCourse(teacher, { price: 0 });

        const res = await request(app).post(`/courses/cart/${course._id}`).set(authHeader(student));
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("FREE_COURSE_ENROLL_DIRECTLY");
    });

    it("400s adding a course the student is already enrolled in", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await createCourse(teacher, { price: 49900 });
        await enrollStudent(student, course);

        const res = await request(app).post(`/courses/cart/${course._id}`).set(authHeader(student));
        expect(res.status).toBe(400);
    });
});

describe("DELETE /courses/cart/:courseId", () => {
    it("removes a course from the cart", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await createCourse(teacher, { price: 49900 });
        await request(app).post(`/courses/cart/${course._id}`).set(authHeader(student));

        const res = await request(app).delete(`/courses/cart/${course._id}`).set(authHeader(student));
        expect(res.status).toBe(200);
        expect(res.body.data.items).toEqual([]);
    });
});

describe("GET /courses/cart/:courseId (inCart)", () => {
    it("reports presence correctly", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await createCourse(teacher, { price: 49900 });

        const before = await request(app).get(`/courses/cart/${course._id}`).set(authHeader(student));
        expect(before.body.data.inCart).toBe(false);

        await request(app).post(`/courses/cart/${course._id}`).set(authHeader(student));

        const after = await request(app).get(`/courses/cart/${course._id}`).set(authHeader(student));
        expect(after.body.data.inCart).toBe(true);
    });
});

describe("POST /courses/cart/merge", () => {
    it("adds every eligible course and is idempotent on a second call", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const courseA = await createCourse(teacher, { price: 49900 });
        const courseB = await createCourse(teacher, { price: 29900 });

        const first = await request(app)
            .post("/courses/cart/merge")
            .set(authHeader(student))
            .send({ courseIds: [String(courseA._id), String(courseB._id)] });
        expect(first.status).toBe(200);
        expect(first.body.data.items).toHaveLength(2);

        const second = await request(app)
            .post("/courses/cart/merge")
            .set(authHeader(student))
            .send({ courseIds: [String(courseA._id), String(courseB._id)] });
        expect(second.status).toBe(200);
        expect(second.body.data.items).toHaveLength(2);
    });

    it("skips a missing, an already-enrolled, and a free course", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const paid = await createCourse(teacher, { price: 49900 });
        const free = await createCourse(teacher, { price: 0 });
        const enrolled = await createCourse(teacher, { price: 19900 });
        await enrollStudent(student, enrolled);
        const missingId = "000000000000000000000000";

        const res = await request(app)
            .post("/courses/cart/merge")
            .set(authHeader(student))
            .send({ courseIds: [String(paid._id), String(free._id), String(enrolled._id), missingId] });

        expect(res.status).toBe(200);
        expect(res.body.data.items).toHaveLength(1);
        expect(res.body.data.items[0].id).toBe(String(paid._id));
    });
});
