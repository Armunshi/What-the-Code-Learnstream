import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { signWebhookPayload } from "../webhookSignature.js";

// See uploadSign.test.js for why these are deferred dynamic imports done
// only after MEDIA_PROVIDER is set.
let app;
let env;
let createTeacher, createCourse, authHeader;
let VideoItem, Sections;
let finalizeFakeAsset, forceFakeAssetReady;

beforeAll(async () => {
  process.env.MEDIA_PROVIDER = "fake";
  ({ app } = await import("../../../app.js"));
  ({ env } = await import("../../../config/env.js"));
  ({ createTeacher, createCourse, authHeader } = await import("../../../../tests/helpers.js"));
  ({ VideoItem } = await import("../../../models/curriculumItem.model.js"));
  ({ Sections } = await import("../../../models/section.model.js"));
  ({ finalizeFakeAsset, forceFakeAssetReady } = await import("../providers/fakeStore.js"));
});

afterAll(() => {
  delete process.env.MEDIA_PROVIDER;
});

async function createVideoItem(course) {
  const section = await Sections.create({ course: course._id, title: "Section 1", order: 0 });
  return VideoItem.create({ course: course._id, section: section._id, title: "Lecture 1", order: 0 });
}

// Signs AND completes the upload, landing the item in PROCESSING — the
// webhook only ever fires once Cloudinary already has the base asset (D4
// step 3 confirms that synchronously, off the Admin API, before the eager
// transcode the webhook reports on has even started), so a webhook test has
// no PROCESSING item to finalize without first driving the upload that far.
async function signAndCompleteVideoUpload(teacher, course, item) {
  const signed = await request(app)
    .post("/instructor/uploads/sign")
    .set(authHeader(teacher))
    .send({
      courseId: course._id.toString(),
      target: { kind: "item-video", itemId: item._id.toString() },
      file: { name: "lecture.mp4", size: 1024, mime: "video/mp4" },
    });
  expect(signed.status).toBe(200);
  const { uploadId, publicId } = signed.body.data;

  finalizeFakeAsset({ publicId, resourceType: "video", bytes: 1024, isAsync: true });
  forceFakeAssetReady(publicId);

  const completed = await request(app)
    .post(`/instructor/uploads/${uploadId}/complete`)
    .set(authHeader(teacher))
    .send({ publicId });
  expect(completed.status).toBe(200);

  return publicId;
}

function postWebhook(payload, { timestamp = String(Math.floor(Date.now() / 1000)), badSignature = false } = {}) {
  const rawBody = JSON.stringify(payload);
  const signature = badSignature
    ? "0".repeat(40)
    : signWebhookPayload(rawBody, timestamp, env.cloudinary.apiSecret);

  return request(app)
    .post("/webhooks/cloudinary")
    .set("Content-Type", "application/json")
    .set("X-Cld-Timestamp", timestamp)
    .set("X-Cld-Signature", signature)
    .send(rawBody);
}

describe("POST /webhooks/cloudinary", () => {
  it("401s a payload with an invalid signature", async () => {
    const res = await postWebhook({ public_id: "whatever", secure_url: "https://example.com/x.mp4" }, { badSignature: true });
    expect(res.status).toBe(401);
  });

  it("401s a payload with no signature header at all", async () => {
    const rawBody = JSON.stringify({ public_id: "whatever" });
    const res = await request(app).post("/webhooks/cloudinary").set("Content-Type", "application/json").send(rawBody);
    expect(res.status).toBe(401);
  });

  it("finalizes a PROCESSING video to READY on a validly signed notification", async () => {
    const teacher = await createTeacher();
    const course = await createCourse(teacher);
    const item = await createVideoItem(course);
    const publicId = await signAndCompleteVideoUpload(teacher, course, item);

    const res = await postWebhook({
      public_id: publicId,
      secure_url: `https://res.cloudinary.com/test/video/upload/${publicId}.mp4`,
      bytes: 12345,
      duration: 90,
      eager: [{ secure_url: `https://res.cloudinary.com/test/video/upload/${publicId}.m3u8` }],
    });

    expect(res.status).toBe(200);

    const stored = await VideoItem.findById(item._id);
    expect(stored.media.status).toBe("READY");
    expect(stored.media.mp4Url).toContain(publicId);
    expect(stored.media.hlsUrl).toContain(".m3u8");
    expect(stored.media.durationSec).toBe(90);
  });

  it("a duplicate notification for the same publicId is a no-op, not an error", async () => {
    const teacher = await createTeacher();
    const course = await createCourse(teacher);
    const item = await createVideoItem(course);
    const publicId = await signAndCompleteVideoUpload(teacher, course, item);

    const payload = {
      public_id: publicId,
      secure_url: `https://res.cloudinary.com/test/video/upload/${publicId}.mp4`,
      bytes: 12345,
      duration: 90,
      eager: [{ secure_url: `https://res.cloudinary.com/test/video/upload/${publicId}.m3u8` }],
    };

    const first = await postWebhook(payload);
    expect(first.status).toBe(200);

    const second = await postWebhook(payload);
    expect(second.status).toBe(200);

    const stored = await VideoItem.findById(item._id);
    expect(stored.media.status).toBe("READY");
    expect(stored.media.mp4Url).toContain(publicId);
  });
});
