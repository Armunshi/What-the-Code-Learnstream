import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { createTeacher, createCourse } from "../helpers.js";

// BACKEND_AUDIT.md §3.1 — `res.json(200, new ApiResponse(...))` passed two
// arguments to a function that only takes one, so the response body was the
// literal number 200 and the course was never actually sent.
describe("§3.1 regression — getCourseById", () => {
  it("returns the actual course document, not the literal number 200", async () => {
    const teacher = await createTeacher();
    const course = await createCourse(teacher, { title: "A Real Course Title" });

    const res = await request(app).get(`/courses/${course._id}`);

    expect(res.status).toBe(200);
    expect(res.body.data).not.toBe(200);
    expect(res.body.data._id).toBe(course._id.toString());
    expect(res.body.data.title).toBe("A Real Course Title");
  });
});
