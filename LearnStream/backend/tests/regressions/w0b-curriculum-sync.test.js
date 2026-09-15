import { describe, it, expect, vi } from "vitest";

// Mocks the internal media.service.js module directly (not the "cloudinary"
// package tests/setup.js already mocks globally) so this file can control
// exactly what an "upload" returns — including `duration`, which
// tests/setup.js's package-level mock omits and which Lectures.duration
// requires. This is scoped to this file only and touches neither
// tests/setup.js nor tests/helpers.js (both W0-C-owned).
vi.mock("../../src/services/media.service.js", () => ({
  uploadOnCloudinary: async () => ({
    secure_url: "https://example.com/video.mp4",
    public_id: "mock_video_id",
    resource_type: "video",
    duration: 120,
  }),
  uploadMultipleFilesOnCloudinary: async (paths) =>
    paths.map((p, i) => ({
      secure_url: `https://example.com/file${i}.pdf`,
      public_id: `mock_file_${i}`,
      resource_type: "raw",
    })),
  deleteMediaFromCloudinary: async () => ({ result: "ok" }),
}));

import { Courses } from "../../src/models/course.model.js";
import { CurriculumItems } from "../../src/models/curriculumItem.model.js";
import * as moduleService from "../../src/services/module.service.js";
import { addLectureToModule, deleteLectureWithMedia } from "../../src/services/lecture.service.js";
import { createAssignment } from "../../src/services/assignment.service.js";
import { recomputeCurriculumStats } from "../../src/services/stats/curriculumStats.js";
import { createTeacher, createCourse } from "../helpers.js";

// W0-B — the legacy module/lecture/assignment adapters are still the only
// authoring path until CURR (Wave 2) lands, so every write they make has to
// mirror into CurriculumItems (D1) under the SAME _id, or the new curriculum/
// playback endpoints would only ever see content that happened to exist
// before migrate-w0-curriculum-v2.js last ran. See services/curriculum/sync.js.
describe("W0-B — legacy adapters mirror into CurriculumItems", () => {
  it("addLectureToModule creates a matching video CurriculumItem and bumps stats, not editVersion", async () => {
    const teacher = await createTeacher();
    const course = await createCourse(teacher);
    const before = await Courses.findById(course._id);

    const module = await moduleService.createModule(course, { title: "Section 1" });
    const lecture = await addLectureToModule(course, module, {
      title: "Lecture 1",
      videoLocalPath: "/tmp/does-not-exist.mp4",
    });

    const item = await CurriculumItems.findById(lecture._id);
    expect(item).not.toBeNull();
    expect(item.type).toBe("video");
    expect(item.section.toString()).toBe(module._id.toString());
    expect(item.course.toString()).toBe(course._id.toString());
    expect(item.order).toBe(0);
    expect(item.media.mp4Url).toBe("https://example.com/video.mp4");
    expect(item.media.status).toBe("READY");
    expect(item.durationSec).toBe(120);

    const after = await Courses.findById(course._id);
    expect(after.stats.lectureCount).toBe(1);
    expect(after.stats.totalDurationSec).toBe(120);
    expect(after.editVersion).toBe(before.editVersion);
  });

  it("deleteLectureWithMedia removes the mirrored CurriculumItem and updates stats", async () => {
    const teacher = await createTeacher();
    const course = await createCourse(teacher);
    const module = await moduleService.createModule(course, { title: "Section 1" });
    const lecture = await addLectureToModule(course, module, {
      title: "Lecture 1",
      videoLocalPath: "/tmp/does-not-exist.mp4",
    });

    await deleteLectureWithMedia(course, module, lecture);

    expect(await CurriculumItems.findById(lecture._id)).toBeNull();
    const after = await Courses.findById(course._id);
    expect(after.stats.lectureCount).toBe(0);
  });

  it("createAssignment appends its CurriculumItem after existing lectures in the same section", async () => {
    const teacher = await createTeacher();
    const course = await createCourse(teacher);
    const module = await moduleService.createModule(course, { title: "Section 1" });
    await addLectureToModule(course, module, { title: "Lecture 1", videoLocalPath: "/tmp/x.mp4" });

    const assignment = await createAssignment(course, module, {
      title: "Assignment 1",
      deadline: null,
      files: [{ path: "/tmp/does-not-exist.pdf" }],
    });

    const item = await CurriculumItems.findById(assignment._id);
    expect(item).not.toBeNull();
    expect(item.type).toBe("assignment");
    // One lecture already occupies order 0 in this section, so the
    // assignment is appended after it (D1: "assignments become items
    // appended after the lectures in the same section").
    expect(item.order).toBe(1);

    const after = await Courses.findById(course._id);
    expect(after.stats.lectureCount).toBe(1);
  });
});

describe("W0-B — recomputeCurriculumStats never bumps editVersion", () => {
  it("only touches stats.* dotted paths", async () => {
    const teacher = await createTeacher();
    const course = await createCourse(teacher);
    await Courses.updateOne({ _id: course._id }, { $set: { editVersion: 7 } });

    const module = await moduleService.createModule(course, { title: "Section 1" });
    await addLectureToModule(course, module, { title: "Lecture 1", videoLocalPath: "/tmp/x.mp4" });

    // A direct call, simulating a background recompute unrelated to any
    // authoring edit (docs/contracts/domain-model.md D3).
    await recomputeCurriculumStats(course._id);

    const after = await Courses.findById(course._id);
    expect(after.editVersion).toBe(7);
    expect(after.stats.lectureCount).toBe(1);
  });
});
