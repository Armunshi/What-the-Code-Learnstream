import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { createTeacher, createStudent, createCourse, enrollStudent, authHeader } from "../helpers.js";

// BACKEND_AUDIT.md §1.2 — teacher B could read teacher A's enrolled-student
// list (name, email) for a course B never authored, because the handlers had
// no ownership check at all. requireCourseOwner('course') closes it; this
// asserts teacher B gets 403, not the data.
describe("§1.2 regression — cross-teacher ownership on enrolled-student data", () => {
  it("403s a teacher who does not own the course", async () => {
    const owner = await createTeacher();
    const otherTeacher = await createTeacher();
    const student = await createStudent();
    const course = await createCourse(owner);
    await enrollStudent(student, course);

    const res = await request(app)
      .get(`/courses/${course._id}/students`)
      .set(authHeader(otherTeacher));

    expect(res.status).toBe(403);
    expect(JSON.stringify(res.body)).not.toContain(student.email);
  });

  it("200s the owning teacher with the enrolled student's data", async () => {
    const owner = await createTeacher();
    const student = await createStudent();
    const course = await createCourse(owner);
    await enrollStudent(student, course);

    const res = await request(app)
      .get(`/courses/${course._id}/students`)
      .set(authHeader(owner));

    expect(res.status).toBe(200);
    expect(res.body.data.enrolledStudents.map(String)).toContain(student._id.toString());
  });
});
