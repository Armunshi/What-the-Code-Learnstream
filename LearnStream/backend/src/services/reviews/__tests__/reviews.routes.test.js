import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../../app.js";
import { Review } from "../../../models/review.model.js";
import { Courses } from "../../../models/course.model.js";
import {
    createTeacher,
    createStudent,
    createCourse,
    enrollStudent,
    authHeader,
} from "../../../../tests/helpers.js";

// Route-level coverage for the 5 W1-REV endpoints (plan §W1-REV "Tests:").
// Colocated under services/reviews/__tests__ (not backend/tests/regressions)
// because docs/lanes/rev.json's ownership manifest grants "backend/src/
// services/reviews/**" but no backend/tests/** glob — see this lane's final
// report for the amendment this gap should get.
describe("W1-REV — GET /courses/:courseId/reviews and rating-summary", () => {
    it("a rating of 4.3 is rejected with 400", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await createCourse(teacher);
        await enrollStudent(student, course);

        const res = await request(app)
            .post(`/courses/${course._id}/reviews`)
            .set(authHeader(student))
            .send({ rating: 4.3, comment: "almost a half step" });

        expect(res.status).toBe(400);
    });

    it("a non-enrolled student gets 403 on create", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await createCourse(teacher);

        const res = await request(app)
            .post(`/courses/${course._id}/reviews`)
            .set(authHeader(student))
            .send({ rating: 5, comment: "never took it" });

        expect(res.status).toBe(403);
    });

    it("a second review from the same student is rejected with 409", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await createCourse(teacher);
        await enrollStudent(student, course);

        await request(app).post(`/courses/${course._id}/reviews`).set(authHeader(student)).send({ rating: 4 });
        const res = await request(app)
            .post(`/courses/${course._id}/reviews`)
            .set(authHeader(student))
            .send({ rating: 5 });

        expect(res.status).toBe(409);
    });

    it("rating-summary distribution always sums to 100 once reviews exist", async () => {
        const teacher = await createTeacher();
        const course = await createCourse(teacher);
        const students = await Promise.all([createStudent(), createStudent(), createStudent()]);
        await Promise.all(students.map((s) => enrollStudent(s, course)));

        await request(app).post(`/courses/${course._id}/reviews`).set(authHeader(students[0])).send({ rating: 5 });
        await request(app).post(`/courses/${course._id}/reviews`).set(authHeader(students[1])).send({ rating: 4 });
        await request(app).post(`/courses/${course._id}/reviews`).set(authHeader(students[2])).send({ rating: 4 });

        const res = await request(app).get(`/courses/${course._id}/rating-summary`);
        expect(res.status).toBe(200);
        const sum = Object.values(res.body.data.ratingDistribution).reduce((a, b) => a + b, 0);
        expect(sum).toBe(100);
        expect(res.body.data.totalRatingsCount).toBe(3);
    });

    it("stats are correct after a review is deleted", async () => {
        const teacher = await createTeacher();
        const course = await createCourse(teacher);
        const student = await createStudent();
        await enrollStudent(student, course);

        await request(app).post(`/courses/${course._id}/reviews`).set(authHeader(student)).send({ rating: 5 });
        let refreshed = await Courses.findById(course._id);
        expect(refreshed.stats.ratingCount).toBe(1);

        const del = await request(app).delete(`/courses/${course._id}/reviews/mine`).set(authHeader(student));
        expect(del.status).toBe(200);

        refreshed = await Courses.findById(course._id);
        expect(refreshed.stats.ratingCount).toBe(0);
        expect(refreshed.stats.ratingAvg).toBe(0);
        expect(await Review.countDocuments({ course: course._id })).toBe(0);
    });

    it("a guest sees NONE for userVoteStatus/isMine false; an authenticated viewer sees their own vote", async () => {
        const teacher = await createTeacher();
        const author = await createStudent();
        const voter = await createStudent();
        const course = await createCourse(teacher);
        await enrollStudent(author, course);
        await enrollStudent(voter, course);

        const created = await request(app)
            .post(`/courses/${course._id}/reviews`)
            .set(authHeader(author))
            .send({ rating: 5, comment: "great" });
        const reviewId = created.body.data.id;

        await request(app).put(`/reviews/${reviewId}/vote`).set(authHeader(voter)).send({ status: "HELPFUL" });

        const guestList = await request(app).get(`/courses/${course._id}/reviews`);
        expect(guestList.body.data.items[0].userVoteStatus).toBe("NONE");
        expect(guestList.body.data.items[0].isMine).toBe(false);

        const voterList = await request(app).get(`/courses/${course._id}/reviews`).set(authHeader(voter));
        expect(voterList.body.data.items[0].userVoteStatus).toBe("HELPFUL");
        expect(voterList.body.data.items[0].isMine).toBe(false);

        const authorList = await request(app).get(`/courses/${course._id}/reviews`).set(authHeader(author));
        expect(authorList.body.data.items[0].isMine).toBe(true);
    });
});

describe("W1-REV — PUT /reviews/:reviewId/vote (D7 state machine)", () => {
    const setupReview = async () => {
        const teacher = await createTeacher();
        const author = await createStudent();
        const voter = await createStudent();
        const course = await createCourse(teacher);
        await enrollStudent(author, course);
        await enrollStudent(voter, course);
        const created = await request(app)
            .post(`/courses/${course._id}/reviews`)
            .set(authHeader(author))
            .send({ rating: 5 });
        return { course, author, voter, reviewId: created.body.data.id };
    };

    it("transitions NONE -> HELPFUL -> UNHELPFUL -> NONE with exact counts at each step", async () => {
        const { reviewId, voter } = await setupReview();

        const toHelpful = await request(app)
            .put(`/reviews/${reviewId}/vote`)
            .set(authHeader(voter))
            .send({ status: "HELPFUL" });
        expect(toHelpful.status).toBe(200);
        expect(toHelpful.body.data).toMatchObject({ helpfulCount: 1, unhelpfulCount: 0, userVoteStatus: "HELPFUL" });

        const toUnhelpful = await request(app)
            .put(`/reviews/${reviewId}/vote`)
            .set(authHeader(voter))
            .send({ status: "UNHELPFUL" });
        expect(toUnhelpful.body.data).toMatchObject({
            helpfulCount: 0,
            unhelpfulCount: 1,
            userVoteStatus: "UNHELPFUL",
        });

        const toNone = await request(app)
            .put(`/reviews/${reviewId}/vote`)
            .set(authHeader(voter))
            .send({ status: "NONE" });
        expect(toNone.body.data).toMatchObject({ helpfulCount: 0, unhelpfulCount: 0, userVoteStatus: "NONE" });

        const refreshed = await Review.findById(reviewId);
        expect(refreshed.helpfulCount).toBe(0);
        expect(refreshed.unhelpfulCount).toBe(0);
    });

    it("voting on your own review is rejected with 403", async () => {
        const { reviewId, author } = await setupReview();

        const res = await request(app)
            .put(`/reviews/${reviewId}/vote`)
            .set(authHeader(author))
            .send({ status: "HELPFUL" });

        expect(res.status).toBe(403);
    });

    it("a guest vote is rejected with 401", async () => {
        const { reviewId } = await setupReview();

        const res = await request(app).put(`/reviews/${reviewId}/vote`).send({ status: "HELPFUL" });

        expect(res.status).toBe(401);
    });

    it("re-voting the same status is idempotent (still exactly one count)", async () => {
        const { reviewId, voter } = await setupReview();

        await request(app).put(`/reviews/${reviewId}/vote`).set(authHeader(voter)).send({ status: "HELPFUL" });
        const again = await request(app)
            .put(`/reviews/${reviewId}/vote`)
            .set(authHeader(voter))
            .send({ status: "HELPFUL" });

        expect(again.body.data.helpfulCount).toBe(1);
    });

    it("rejects an invalid status value with 400", async () => {
        const { reviewId, voter } = await setupReview();

        const res = await request(app)
            .put(`/reviews/${reviewId}/vote`)
            .set(authHeader(voter))
            .send({ status: "LOVE_IT" });

        expect(res.status).toBe(400);
    });
});
