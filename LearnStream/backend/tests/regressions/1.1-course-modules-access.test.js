import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { createTeacher, createStudent, createCourse, enrollStudent, createModuleWithContent, authHeader } from "../helpers.js";

// BACKEND_AUDIT.md §1.1 — GET /courses/:course_id/modules used to require no
// authentication at all and returned every lecture's public_id, which is the
// only secret needed to build a direct, unauthenticated Cloudinary URL. A
// single assertion here (401 with no token) would have caught it.
describe("§1.1 regression — course modules access", () => {
  it("401s with no access token at all", async () => {
    const teacher = await createTeacher();
    const course = await createCourse(teacher);

    const res = await request(app).get(`/courses/${course._id}/modules`);

    expect(res.status).toBe(401);
  });

  it("strips public_id for an authenticated caller who neither owns nor is enrolled in the course", async () => {
    const teacher = await createTeacher();
    const outsider = await createStudent();
    const course = await createCourse(teacher);
    const { lecture } = await createModuleWithContent(course);

    const res = await request(app)
      .get(`/courses/${course._id}/modules`)
      .set(authHeader(outsider));

    expect(res.status).toBe(200);
    const returnedLecture = res.body.data[0].lectures[0];
    expect(returnedLecture.public_id).toBeUndefined();
    expect(returnedLecture.title).toBe(lecture.title);
  });

  it("returns public_id to the owning teacher", async () => {
    const teacher = await createTeacher();
    const course = await createCourse(teacher);
    const { lecture } = await createModuleWithContent(course);

    const res = await request(app)
      .get(`/courses/${course._id}/modules`)
      .set(authHeader(teacher));

    expect(res.status).toBe(200);
    expect(res.body.data[0].lectures[0].public_id).toBe(lecture.public_id);
  });

  it("returns public_id to an enrolled student", async () => {
    const teacher = await createTeacher();
    const student = await createStudent();
    const course = await createCourse(teacher);
    await enrollStudent(student, course);
    const { lecture } = await createModuleWithContent(course);

    const res = await request(app)
      .get(`/courses/${course._id}/modules`)
      .set(authHeader(student));

    expect(res.status).toBe(200);
    expect(res.body.data[0].lectures[0].public_id).toBe(lecture.public_id);
  });
});
