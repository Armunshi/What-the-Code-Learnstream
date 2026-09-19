import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../../app.js";
import { User } from "../../../models/user.model.js";
import { Order } from "../../../models/order.model.js";
import { createTeacher, createStudent, createCourse, authHeader } from "../../../../tests/helpers.js";

// tests/helpers.js's createUser() only forwards {name, email, password} from
// its `overrides` — any other field (username, emailVerifiedAt, firstName...)
// has to be set directly against the model, since this lane doesn't own that
// shared helper file.
const withFields = async (user, fields) => {
    Object.assign(user, fields);
    await user.save({ validateBeforeSave: false });
    return user;
};

// Coverage for docs/lanes/acc.json's backend endpoints: GET /users/me, PATCH
// /users/me/profile, POST /users/me/avatar, PATCH /users/me/password, GET
// /users/me/purchases, GET /users/:username, and the wishlist GET/POST/
// DELETE trio. The five regressions the plan names explicitly ("avatar 6 MB
// or GIF -> 400; wrong current password -> 401; old refresh token -> 401
// after a change; purchases are isolated per user; username collision and
// hex rejection") each get their own test below, same as W1-SHELL's suite.

describe("GET /users/me", () => {
    it("returns the caller's own profile without password or refreshToken", async () => {
        const student = await createStudent();
        const res = await request(app).get("/users/me").set(authHeader(student));

        expect(res.status).toBe(200);
        expect(res.body.data.email).toBe(student.email);
        expect(res.body.data.password).toBeUndefined();
        expect(res.body.data.refreshToken).toBeUndefined();
    });

    it("401s without a token", async () => {
        const res = await request(app).get("/users/me");
        expect(res.status).toBe(401);
    });
});

describe("PATCH /users/me/profile", () => {
    it("updates headline, bio, and links", async () => {
        const student = await createStudent();
        const res = await request(app)
            .patch("/users/me/profile")
            .set(authHeader(student))
            .send({
                headline: "Full-stack instructor",
                bio: "I teach web development.",
                links: [{ label: "Site", url: "https://example.com" }],
            });

        expect(res.status).toBe(200);
        expect(res.body.data.headline).toBe("Full-stack instructor");
        expect(res.body.data.links).toEqual([{ label: "Site", url: "https://example.com" }]);
    });

    it("400s a headline over 60 characters", async () => {
        const student = await createStudent();
        const res = await request(app)
            .patch("/users/me/profile")
            .set(authHeader(student))
            .send({ headline: "x".repeat(61) });

        expect(res.status).toBe(400);
        expect(res.body.errors[0]).toMatchObject({ field: "headline" });
    });

    it("400s a non-https link", async () => {
        const student = await createStudent();
        const res = await request(app)
            .patch("/users/me/profile")
            .set(authHeader(student))
            .send({ links: [{ label: "Site", url: "http://example.com" }] });

        expect(res.status).toBe(400);
    });

    it("400s a username that looks like a 24-hex ObjectId", async () => {
        const student = await createStudent();
        const res = await request(app)
            .patch("/users/me/profile")
            .set(authHeader(student))
            .send({ username: "507f1f77bcf86cd799439011" });

        expect(res.status).toBe(400);
    });

    it("409s a username already taken by another user", async () => {
        const taken = await createStudent();
        await withFields(taken, { username: "already-taken" });
        const student = await createStudent();

        const res = await request(app)
            .patch("/users/me/profile")
            .set(authHeader(student))
            .send({ username: "already-taken" });

        expect(res.status).toBe(409);
        expect(res.body.errors[0]).toMatchObject({ field: "username", code: "USERNAME_EXISTS" });
    });
});

describe("POST /users/me/avatar", () => {
    it("400s a GIF upload", async () => {
        const student = await createStudent();
        const res = await request(app)
            .post("/users/me/avatar")
            .set(authHeader(student))
            .attach("avatar", Buffer.from("GIF89a"), { filename: "photo.gif", contentType: "image/gif" });

        expect(res.status).toBe(400);
    });

    it("400s a file over 5 MB", async () => {
        const student = await createStudent();
        const big = Buffer.alloc(6 * 1024 * 1024, 1);
        const res = await request(app)
            .post("/users/me/avatar")
            .set(authHeader(student))
            .attach("avatar", big, { filename: "photo.jpg", contentType: "image/jpeg" });

        expect(res.status).toBe(400);
    });

    it("accepts a small JPEG and stores the returned url", async () => {
        const student = await createStudent();
        const res = await request(app)
            .post("/users/me/avatar")
            .set(authHeader(student))
            .attach("avatar", Buffer.from("fake-jpeg-bytes"), { filename: "photo.jpg", contentType: "image/jpeg" });

        expect(res.status).toBe(200);
        expect(res.body.data.avatar).toBeTruthy();

        const updated = await User.findById(student._id);
        expect(updated.avatar).toBe(res.body.data.avatar);
    });
});

describe("PATCH /users/me/password", () => {
    it("401s the wrong current password", async () => {
        const student = await createStudent({ password: "correct-horse-1" });
        const res = await request(app)
            .patch("/users/me/password")
            .set(authHeader(student))
            .send({ currentPassword: "wrong-password", newPassword: "new-password-1" });

        expect(res.status).toBe(401);
    });

    it("rotates the refresh token so the old one 401s on refresh", async () => {
        const student = await createStudent({ password: "correct-horse-1" });

        const loginRes = await request(app)
            .post("/user/student/login")
            .send({ email: student.email, password: "correct-horse-1" });
        expect(loginRes.status).toBe(200);
        const oldRefreshToken = loginRes.body.data.refreshToken;

        // jwt.sign's `iat`/`exp` claims only have one-second resolution, and
        // generateRefreshToken() signs from nothing but {_id} — two tokens
        // minted for the same user within the same wall-clock second are
        // byte-for-byte identical, which would make "the old token" and "the
        // freshly rotated token" the same string and this assertion vacuous.
        // A short real wait crosses that second boundary deterministically.
        await new Promise((resolve) => setTimeout(resolve, 1100));

        const changeRes = await request(app)
            .patch("/users/me/password")
            .set(authHeader(student))
            .send({ currentPassword: "correct-horse-1", newPassword: "brand-new-password" });
        expect(changeRes.status).toBe(200);
        expect(changeRes.body.data.refreshToken).toBeUndefined();

        const refreshRes = await request(app)
            .post("/auth/refresh-Token")
            .set("Cookie", [`studentRefreshToken=${oldRefreshToken}`]);
        expect(refreshRes.status).toBe(401);
    });
});

describe("GET /users/me/purchases", () => {
    it("isolates purchases per user", async () => {
        const teacher = await createTeacher();
        const [studentA, studentB] = await Promise.all([createStudent(), createStudent()]);
        const course = await createCourse(teacher, { price: 49900 });

        await Order.create({
            course_ids: [course._id],
            user_id: studentA._id,
            razorpayOrder_id: `order_${Date.now()}_a`,
            amount: course.price,
            status: "paid",
            paidAt: new Date(),
        });

        const [resA, resB] = await Promise.all([
            request(app).get("/users/me/purchases").set(authHeader(studentA)),
            request(app).get("/users/me/purchases").set(authHeader(studentB)),
        ]);

        expect(resA.status).toBe(200);
        expect(resA.body.data.items).toHaveLength(1);
        expect(resA.body.data.items[0].courseId).toBe(String(course._id));

        expect(resB.status).toBe(200);
        expect(resB.body.data.items).toHaveLength(0);
    });

    it("excludes orders that were never paid", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await createCourse(teacher);

        await Order.create({
            course_ids: [course._id],
            user_id: student._id,
            razorpayOrder_id: `order_${Date.now()}_created`,
            amount: course.price,
            status: "created",
        });

        const res = await request(app).get("/users/me/purchases").set(authHeader(student));
        expect(res.body.data.items).toHaveLength(0);
    });
});

describe("GET /users/:username", () => {
    it("returns the public profile with a verified badge", async () => {
        const teacher = await withFields(await createTeacher(), {
            username: "jane-teaches",
            emailVerifiedAt: new Date(),
        });

        const res = await request(app).get(`/users/${teacher.username}`);
        expect(res.status).toBe(200);
        expect(res.body.data.username).toBe("jane-teaches");
        expect(res.body.data.verified).toBe(true);
        expect(res.body.data.email).toBeUndefined();
    });

    it("404s an unknown username", async () => {
        const res = await request(app).get("/users/no-such-user");
        expect(res.status).toBe(404);
    });
});

describe("Wishlist", () => {
    it("adds, lists, and removes a course", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await createCourse(teacher);

        const addRes = await request(app)
            .post("/users/me/wishlist")
            .set(authHeader(student))
            .send({ courseId: String(course._id) });
        expect(addRes.status).toBe(201);
        expect(addRes.body.data.items).toHaveLength(1);
        expect(addRes.body.data.items[0].id).toBe(String(course._id));

        const listRes = await request(app).get("/users/me/wishlist").set(authHeader(student));
        expect(listRes.body.data.items).toHaveLength(1);

        const removeRes = await request(app)
            .delete(`/users/me/wishlist/${course._id}`)
            .set(authHeader(student));
        expect(removeRes.status).toBe(200);
        expect(removeRes.body.data.items).toHaveLength(0);
    });

    it("404s adding a course that doesn't exist", async () => {
        const student = await createStudent();
        const res = await request(app)
            .post("/users/me/wishlist")
            .set(authHeader(student))
            .send({ courseId: String(student._id) }); // any well-formed id with no matching course

        expect(res.status).toBe(404);
    });
});
