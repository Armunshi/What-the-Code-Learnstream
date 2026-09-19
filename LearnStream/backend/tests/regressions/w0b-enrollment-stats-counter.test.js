import { describe, it, expect } from "vitest";
import { enrollStudentInCourses } from "../../src/services/enrollment.service.js";
import { Courses } from "../../src/models/course.model.js";
import { createStudent, createTeacher, createCourse } from "../helpers.js";

// W0-B: enrollStudentInCourses now does one atomic updateOne (filter:
// enrolledStudents $ne studentId, update: $push + $inc stats.enrollmentCount)
// instead of a read-then-write, specifically so a duplicate enroll call can
// never double-increment the counter (docs/contracts/domain-model.md D3 —
// stats writers must never race each other into a wrong count). This is a
// permanent test for that property; tests/regressions/1.3-enrollment-service.test.js
// already covers the pre-existing "doesn't double-enroll the student"
// behavior and is left unmodified — this adds the stats-counter assertion
// that test didn't make.
describe("W0-B — enrollment stats.enrollmentCount never double-increments", () => {
    it("increments the counter exactly once across two enroll calls for the same student", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await createCourse(teacher);

        await enrollStudentInCourses(student._id, [course._id.toString()]);
        await enrollStudentInCourses(student._id, [course._id.toString()]);

        const refreshed = await Courses.findById(course._id);
        expect(refreshed.stats.enrollmentCount).toBe(1);
    });

    it("increments once per distinct student, not per call", async () => {
        const teacher = await createTeacher();
        const studentA = await createStudent();
        const studentB = await createStudent();
        const course = await createCourse(teacher);

        await enrollStudentInCourses(studentA._id, [course._id.toString()]);
        await enrollStudentInCourses(studentB._id, [course._id.toString()]);
        await enrollStudentInCourses(studentA._id, [course._id.toString()]); // duplicate

        const refreshed = await Courses.findById(course._id);
        expect(refreshed.stats.enrollmentCount).toBe(2);
    });

    it("concurrent duplicate enroll calls still only increment once", async () => {
        const teacher = await createTeacher();
        const student = await createStudent();
        const course = await createCourse(teacher);

        await Promise.all([
            enrollStudentInCourses(student._id, [course._id.toString()]),
            enrollStudentInCourses(student._id, [course._id.toString()]),
            enrollStudentInCourses(student._id, [course._id.toString()]),
        ]);

        const refreshed = await Courses.findById(course._id);
        expect(refreshed.stats.enrollmentCount).toBe(1);
        expect(refreshed.enrolledStudents).toHaveLength(1);
    });
});
