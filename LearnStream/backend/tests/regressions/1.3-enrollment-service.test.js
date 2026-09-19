import { describe, it, expect } from "vitest";
import { enrollStudentInCourses } from "../../src/services/enrollment.service.js";
import { User } from "../../src/models/user.model.js";
import { createStudent, createTeacher, createCourse } from "../helpers.js";

// BACKEND_AUDIT.md §1.3 — /courses/enroll 500d on every call because of a
// missing import. That standalone route is gone (enrollment now only happens
// through payment fulfilment), but the shared service both that old route and
// Payment.controller.js's fulfilOrder called is still live code — this pins
// down that it actually enrolls, doesn't crash on a bad id, and doesn't
// double-enroll.
describe("§1.3 regression — enrollStudentInCourses", () => {
  it("enrolls a student in each course and updates both sides of the relationship", async () => {
    const teacher = await createTeacher();
    const student = await createStudent();
    const courseA = await createCourse(teacher);
    const courseB = await createCourse(teacher);

    const results = await enrollStudentInCourses(student._id, [courseA._id.toString(), courseB._id.toString()]);

    expect(results.every((r) => r.status === "Enrolled")).toBe(true);

    const refreshed = await User.findById(student._id);
    expect(refreshed.Courses.map(String)).toEqual(
      expect.arrayContaining([courseA._id.toString(), courseB._id.toString()])
    );
  });

  it("does not crash and reports a clear status for a course id that doesn't exist", async () => {
    const student = await createStudent();
    const fakeCourseId = "64f000000000000000000000";

    const results = await enrollStudentInCourses(student._id, [fakeCourseId]);

    expect(results).toEqual([{ course_id: fakeCourseId, status: "Course not found" }]);
  });

  it("does not double-enroll a student who is already enrolled", async () => {
    const teacher = await createTeacher();
    const student = await createStudent();
    const course = await createCourse(teacher);

    await enrollStudentInCourses(student._id, [course._id.toString()]);
    const secondAttempt = await enrollStudentInCourses(student._id, [course._id.toString()]);

    expect(secondAttempt).toEqual([{ course_id: course._id.toString(), status: "Already enrolled" }]);

    const refreshed = await User.findById(student._id);
    const occurrences = refreshed.Courses.filter((id) => id.toString() === course._id.toString());
    expect(occurrences).toHaveLength(1);
  });
});
