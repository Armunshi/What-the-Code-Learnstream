import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";

// MEDIA_PROVIDER must be "fake" (D4 step 6) before config/env.js is ever
// imported — services/media/index.js reads env.media.provider once, at ITS
// OWN import time, into a frozen module-level binding, so anything that
// imports config/env.js first locks the value in for the rest of this
// file's module registry regardless of what process.env holds later. That
// includes tests/helpers.js (it imports the User model, which needs
// ACCESS_TOKEN_SECRET from config/env.js), so even helpers.js has to be
// deferred into beforeAll, after the env var is set — a static top-level
// import of it, same as a static import of app.js, would already have
// resolved config/env.js with the wrong value by the time beforeAll runs.
let app;
let createTeacher, createStudent, createCourse, authHeader;

beforeAll(async () => {
  process.env.MEDIA_PROVIDER = "fake";
  ({ app } = await import("../../../app.js"));
  ({ createTeacher, createStudent, createCourse, authHeader } = await import("../../../../tests/helpers.js"));
});

afterAll(() => {
  delete process.env.MEDIA_PROVIDER;
});

const validFile = { name: "thumb.jpg", size: 1024, mime: "image/jpeg" };

describe("POST /instructor/uploads/sign", () => {
  it("401s with no access token", async () => {
    const teacher = await createTeacher();
    const course = await createCourse(teacher);

    const res = await request(app)
      .post("/instructor/uploads/sign")
      .send({ courseId: course._id.toString(), target: { kind: "course-thumbnail" }, file: validFile });

    expect(res.status).toBe(401);
  });

  it("403s a student (only teachers may sign an upload)", async () => {
    const teacher = await createTeacher();
    const student = await createStudent();
    const course = await createCourse(teacher);

    const res = await request(app)
      .post("/instructor/uploads/sign")
      .set(authHeader(student))
      .send({ courseId: course._id.toString(), target: { kind: "course-thumbnail" }, file: validFile });

    expect(res.status).toBe(403);
  });

  it("403s a teacher who does not own the course", async () => {
    const owner = await createTeacher();
    const otherTeacher = await createTeacher();
    const course = await createCourse(owner);

    const res = await request(app)
      .post("/instructor/uploads/sign")
      .set(authHeader(otherTeacher))
      .send({ courseId: course._id.toString(), target: { kind: "course-thumbnail" }, file: validFile });

    expect(res.status).toBe(403);
  });

  it("400s a mime type the target kind's policy does not allow", async () => {
    const teacher = await createTeacher();
    const course = await createCourse(teacher);

    const res = await request(app)
      .post("/instructor/uploads/sign")
      .set(authHeader(teacher))
      .send({
        courseId: course._id.toString(),
        target: { kind: "course-thumbnail" },
        file: { name: "video.mp4", size: 1024, mime: "video/mp4" },
      });

    expect(res.status).toBe(400);
    expect(res.body.errors?.[0]?.code).toBe("UNSUPPORTED_MIME_TYPE");
  });

  it("400s a file larger than the target kind's policy allows", async () => {
    const teacher = await createTeacher();
    const course = await createCourse(teacher);

    const res = await request(app)
      .post("/instructor/uploads/sign")
      .set(authHeader(teacher))
      .send({
        courseId: course._id.toString(),
        target: { kind: "course-thumbnail" },
        file: { name: "thumb.jpg", size: 999_999_999, mime: "image/jpeg" },
      });

    expect(res.status).toBe(400);
    expect(res.body.errors?.[0]?.code).toBe("FILE_TOO_LARGE");
  });

  it("signs a valid course-thumbnail upload for its owning teacher", async () => {
    const teacher = await createTeacher();
    const course = await createCourse(teacher);

    const res = await request(app)
      .post("/instructor/uploads/sign")
      .set(authHeader(teacher))
      .send({ courseId: course._id.toString(), target: { kind: "course-thumbnail" }, file: validFile });

    expect(res.status).toBe(200);
    expect(res.body.data.provider).toBe("fake");
    expect(res.body.data.resourceType).toBe("image");
    expect(res.body.data.uploadId).toBeTruthy();
    expect(res.body.data.publicId).toBeTruthy();
    expect(res.body.data.uploadUrl).toContain("/__e2e__/media/upload/image");
    expect(res.body.data.chunkSizeBytes).toBeGreaterThan(0);
  });
});
