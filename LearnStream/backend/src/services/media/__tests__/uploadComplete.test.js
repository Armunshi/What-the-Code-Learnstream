import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";

// See uploadSign.test.js for why every one of these has to be a deferred
// dynamic import, done only after MEDIA_PROVIDER is set: config/env.js is
// evaluated the first time anything imports it (directly, or transitively
// through tests/helpers.js's User model), and services/media/index.js reads
// env.media.provider once, at its own import time, into a frozen binding.
let app;
let createTeacher, createCourse, authHeader;
let finalizeFakeAsset, getFakeAsset;

beforeAll(async () => {
  process.env.MEDIA_PROVIDER = "fake";
  ({ app } = await import("../../../app.js"));
  ({ createTeacher, createCourse, authHeader } = await import("../../../../tests/helpers.js"));
  ({ finalizeFakeAsset, getFakeAsset } = await import("../providers/fakeStore.js"));
});

afterAll(() => {
  delete process.env.MEDIA_PROVIDER;
});

async function signThumbnail(app, teacher, course) {
  const res = await request(app)
    .post("/instructor/uploads/sign")
    .set(authHeader(teacher))
    .send({
      courseId: course._id.toString(),
      target: { kind: "course-thumbnail" },
      file: { name: "thumb.jpg", size: 1024, mime: "image/jpeg" },
    });
  expect(res.status).toBe(200);
  return res.body.data;
}

describe("POST /instructor/uploads/:uploadId/complete", () => {
  it("400s when the publicId does not match what the upload was signed for", async () => {
    const teacher = await createTeacher();
    const course = await createCourse(teacher);
    const signed = await signThumbnail(app, teacher, course);
    finalizeFakeAsset({ publicId: signed.publicId, resourceType: "image", bytes: 1024, isAsync: false });

    const res = await request(app)
      .post(`/instructor/uploads/${signed.uploadId}/complete`)
      .set(authHeader(teacher))
      .send({ publicId: "some/other/public-id" });

    expect(res.status).toBe(400);
    expect(res.body.errors?.[0]?.code).toBe("PUBLIC_ID_MISMATCH");
  });

  it("422s when the provider has no asset at the signed publicId yet", async () => {
    const teacher = await createTeacher();
    const course = await createCourse(teacher);
    const signed = await signThumbnail(app, teacher, course);
    // Deliberately never call finalizeFakeAsset — nothing was "uploaded".

    const res = await request(app)
      .post(`/instructor/uploads/${signed.uploadId}/complete`)
      .set(authHeader(teacher))
      .send({ publicId: signed.publicId });

    expect(res.status).toBe(422);
  });

  it("completes a synchronous (image) upload and writes the course thumbnail immediately", async () => {
    const teacher = await createTeacher();
    const course = await createCourse(teacher);
    const signed = await signThumbnail(app, teacher, course);
    finalizeFakeAsset({ publicId: signed.publicId, resourceType: "image", bytes: 2048, isAsync: false });

    const res = await request(app)
      .post(`/instructor/uploads/${signed.uploadId}/complete`)
      .set(authHeader(teacher))
      .send({ publicId: signed.publicId });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("READY");

    const { Courses } = await import("../../../models/course.model.js");
    const updated = await Courses.findById(course._id);
    expect(updated.thumbnailPublicId).toBe(signed.publicId);
  });

  it("deletes the old thumbnail asset only once the replacement upload has completed (sync kind)", async () => {
    const teacher = await createTeacher();
    const course = await createCourse(teacher);

    const first = await signThumbnail(app, teacher, course);
    finalizeFakeAsset({ publicId: first.publicId, resourceType: "image", bytes: 1024, isAsync: false });
    await request(app)
      .post(`/instructor/uploads/${first.uploadId}/complete`)
      .set(authHeader(teacher))
      .send({ publicId: first.publicId });

    expect(getFakeAsset(first.publicId)).toBeTruthy();

    const second = await signThumbnail(app, teacher, course);
    finalizeFakeAsset({ publicId: second.publicId, resourceType: "image", bytes: 4096, isAsync: false });
    const res = await request(app)
      .post(`/instructor/uploads/${second.uploadId}/complete`)
      .set(authHeader(teacher))
      .send({ publicId: second.publicId });

    expect(res.status).toBe(200);
    // A sync kind has no PROCESSING gap — the replacement is already
    // confirmed, so the old asset is removed right away (D4 step 5).
    expect(getFakeAsset(first.publicId)).toBeUndefined();
    expect(getFakeAsset(second.publicId)).toBeTruthy();
  });
});
