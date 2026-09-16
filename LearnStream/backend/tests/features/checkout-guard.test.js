import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { createTeacher, createStudent, createCourse, enrollStudent, authHeader } from "../helpers.js";

// Coverage for plan W1-COM's createOrder guard (docs/contracts/
// api-conventions.md D10): POST /payment/create-order rejects free,
// unpublished, or already-enrolled courses with 400
// FREE_COURSE_ENROLL_DIRECTLY instead of letting Razorpay reject a price-0
// order. razorpay is mocked at the SDK boundary (tests/setup.js), so a
// request that gets PAST the guard still succeeds — these tests only cover
// what should never reach that mock.

const publish = async (course) => {
    course.status = "PUBLISHED";
    course.publishedAt = new Date();
    await course.save();
    return course;
};

describe("POST /payment/create-order — free-course guard", () => {
    it("400s FREE_COURSE_ENROLL_DIRECTLY for a free course", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await publish(await createCourse(teacher, { price: 0 }));

        const res = await request(app)
            .post("/payment/create-order")
            .set(authHeader(student))
            .send({ course_ids: [String(course._id)] });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe("FREE_COURSE_ENROLL_DIRECTLY");
    });

    it("400s FREE_COURSE_ENROLL_DIRECTLY for an unpublished (DRAFT) course", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await createCourse(teacher, { price: 49900 }); // left DRAFT

        const res = await request(app)
            .post("/payment/create-order")
            .set(authHeader(student))
            .send({ course_ids: [String(course._id)] });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe("FREE_COURSE_ENROLL_DIRECTLY");
    });

    it("400s FREE_COURSE_ENROLL_DIRECTLY for a course the student is already enrolled in", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await publish(await createCourse(teacher, { price: 49900 }));
        await enrollStudent(student, course);

        const res = await request(app)
            .post("/payment/create-order")
            .set(authHeader(student))
            .send({ course_ids: [String(course._id)] });

        expect(res.status).toBe(400);
        expect(res.body.code).toBe("FREE_COURSE_ENROLL_DIRECTLY");
    });

    it("creates a real order for a published, unenrolled, paid course", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await publish(await createCourse(teacher, { price: 49900 }));

        const res = await request(app)
            .post("/payment/create-order")
            .set(authHeader(student))
            .send({ course_ids: [String(course._id)] });

        expect(res.status).toBe(200);
        expect(res.body.data.amount).toBe(49900);
    });
});
