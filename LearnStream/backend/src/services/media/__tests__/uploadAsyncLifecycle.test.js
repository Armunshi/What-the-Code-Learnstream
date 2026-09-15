import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";

// See uploadSign.test.js for why these are deferred dynamic imports done
// only after MEDIA_PROVIDER is set.
let app;
let createTeacher, createCourse, authHeader;
let finalizeFakeAsset, getFakeAsset, forceFakeAssetReady;
let CurriculumItems, VideoItem, Sections;

beforeAll(async () => {
  process.env.MEDIA_PROVIDER = "fake";
  ({ app } = await import("../../../app.js"));
  ({ createTeacher, createCourse, authHeader } = await import("../../../../tests/helpers.js"));
  ({ finalizeFakeAsset, getFakeAsset, forceFakeAssetReady } = await import("../providers/fakeStore.js"));
  ({ VideoItem, CurriculumItems } = await import("../../../models/curriculumItem.model.js"));
  ({ Sections } = await import("../../../models/section.model.js"));
});

afterAll(() => {
  delete process.env.MEDIA_PROVIDER;
});

async function createVideoItem(course) {
  const section = await Sections.create({ course: course._id, title: "Section 1", order: 0 });
  return VideoItem.create({ course: course._id, section: section._id, title: "Lecture 1", order: 0 });
}

async function signAndCompleteVideo(teacher, course, item) {
  const signed = await request(app)
    .post("/instructor/uploads/sign")
    .set(authHeader(teacher))
    .send({
      courseId: course._id.toString(),
      target: { kind: "item-video", itemId: item._id.toString() },
      file: { name: "lecture.mp4", size: 1024 * 1024, mime: "video/mp4" },
    });
  expect(signed.status).toBe(200);
  const { uploadId, publicId } = signed.body.data;

  // A video kind is async, so finalizeFakeAsset marks it not-ready and
  // flips ready=true itself after a short delay (fakeStore.js) — force it
  // ready immediately here, the same escape hatch the module documents
  // itself as existing for.
  finalizeFakeAsset({ publicId, resourceType: "video", bytes: 1024 * 1024, isAsync: true });
  forceFakeAssetReady(publicId);

  const completed = await request(app)
    .post(`/instructor/uploads/${uploadId}/complete`)
    .set(authHeader(teacher))
    .send({ publicId });
  expect(completed.status).toBe(200);

  return { uploadId, publicId };
}

describe("Video uploads — PROCESSING until the provider confirms the transcode, replace-after-ready", () => {
  it("/complete lands an item-video upload in PROCESSING, not READY", async () => {
    const teacher = await createTeacher();
    const course = await createCourse(teacher);
    const item = await createVideoItem(course);

    const { publicId } = await signAndCompleteVideo(teacher, course, item);

    const stored = await VideoItem.findById(item._id);
    expect(stored.media.status).toBe("PROCESSING");
    expect(stored.media.publicId).toBe(publicId);
  });

  it("does not delete the previous video asset while the replacement is still PROCESSING", async () => {
    const teacher = await createTeacher();
    const course = await createCourse(teacher);
    const item = await createVideoItem(course);

    const first = await signAndCompleteVideo(teacher, course, item);

    // Sign + complete a second upload for the same item without forcing the
    // reconcile poll — the first asset must still exist right after
    // /complete, because D4 step 5 only deletes it once the REPLACEMENT is
    // READY, and this replacement is still PROCESSING.
    const secondSigned = await request(app)
      .post("/instructor/uploads/sign")
      .set(authHeader(teacher))
      .send({
        courseId: course._id.toString(),
        target: { kind: "item-video", itemId: item._id.toString() },
        file: { name: "lecture-v2.mp4", size: 2048, mime: "video/mp4" },
      });
    const { uploadId: secondUploadId, publicId: secondPublicId } = secondSigned.body.data;
    finalizeFakeAsset({ publicId: secondPublicId, resourceType: "video", bytes: 2048, isAsync: true });
    forceFakeAssetReady(secondPublicId);
    await request(app)
      .post(`/instructor/uploads/${secondUploadId}/complete`)
      .set(authHeader(teacher))
      .send({ publicId: secondPublicId });

    expect(getFakeAsset(first.publicId)).toBeTruthy();

    // Now finalize the replacement to READY, as the webhook or the
    // reconcile poll would — only THIS should delete the original asset.
    const { finalizeReadyByPublicId } = await import("../uploadTargets.js");
    const verified = await (await import("../providers/fake.js")).fakeProvider.verify({ publicId: secondPublicId });
    await finalizeReadyByPublicId(secondPublicId, verified);

    const updated = await VideoItem.findById(item._id);
    expect(updated.media.status).toBe("READY");
    expect(updated.media.publicId).toBe(secondPublicId);
    expect(getFakeAsset(first.publicId)).toBeUndefined();
    expect(getFakeAsset(secondPublicId)).toBeTruthy();
  });

  it("GET media-status reconciles a stuck PROCESSING item for the fake provider on every poll", async () => {
    const teacher = await createTeacher();
    const course = await createCourse(teacher);
    const item = await createVideoItem(course);
    const { publicId } = await signAndCompleteVideo(teacher, course, item);

    const res = await request(app)
      .get(`/instructor/uploads/courses/${course._id}/status`)
      .query({ ids: item._id.toString() })
      .set(authHeader(teacher));

    expect(res.status).toBe(200);
    const entry = res.body.data.items.find((i) => i.id === item._id.toString());
    expect(entry.status).toBe("READY");

    const stored = await VideoItem.findById(item._id);
    expect(stored.media.status).toBe("READY");
    expect(stored.media.publicId).toBe(publicId);
  });
});
