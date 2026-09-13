import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { Lectures } from "../../src/models/lecture.model.js";
import { Modules } from "../../src/models/module.model.js";
import { Courses } from "../../src/models/course.model.js";
import { createTeacher, createCourse, createModuleWithContent, authHeader } from "../helpers.js";

// BACKEND_AUDIT.md §2.3 — the cascade lived in a Mongoose pre('remove') hook
// that never fired under Mongoose 8 (remove() was removed entirely), silently
// leaving orphaned Lecture/Assignment documents and dangling ids on the
// course behind forever. deleteModuleWithContent now does the cascade
// explicitly; this asserts nothing is left behind.
describe("§2.3 regression — deleteModule cascade", () => {
  it("leaves no orphaned Lecture documents, and removes the ids from the course", async () => {
    const teacher = await createTeacher();
    const course = await createCourse(teacher);
    const { module, lecture } = await createModuleWithContent(course);

    const res = await request(app)
      .delete(`/courses/${course._id}/modules/${module._id}`)
      .set(authHeader(teacher));

    expect(res.status).toBe(200);

    expect(await Modules.findById(module._id)).toBeNull();
    expect(await Lectures.findById(lecture._id)).toBeNull();

    const refreshedCourse = await Courses.findById(course._id);
    expect(refreshedCourse.modules.map(String)).not.toContain(module._id.toString());
    expect(refreshedCourse.lectures.map(String)).not.toContain(lecture._id.toString());
  });
});
