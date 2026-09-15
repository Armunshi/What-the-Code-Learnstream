import { Courses } from "../models/course.model.js";
import { User } from "../models/user.model.js";

// Enrolls a student in each of `course_ids`, skipping ones that no longer
// exist or the student is already enrolled in. Shared by the manual-enroll
// endpoint and the payment-verification flow so both enroll the same way.
const enrollStudentInCourses = async (studentId, course_ids) => {
    const student = await User.findById(studentId);
    if (!student) {
        throw new Error("Student not found");
    }

    const results = [];

    for (const course_id of course_ids) {
        const course = await Courses.findById(course_id).select("_id");
        if (!course) {
            results.push({ course_id, status: "Course not found" });
            continue;
        }

        // One atomic updateOne, not a read-then-write: the filter's
        // `enrolledStudents: { $ne: studentId }` IS the "not already
        // enrolled" check, so `$inc: {'stats.enrollmentCount': 1}` only ever
        // fires in the same operation that actually adds the student.
        // Two concurrent calls for the same student+course race on this one
        // atomic write — exactly one of them matches (and increments the
        // counter once), the other matches nothing and reports "Already
        // enrolled" without touching the counter. A separate read-then-
        // decide-then-write (the previous shape) would let both calls read
        // "not enrolled" before either writes, double-enrolling and
        // double-incrementing (docs/contracts/domain-model.md D3: stats
        // writers must never race each other into an inflated count).
        const result = await Courses.updateOne(
            { _id: course_id, enrolledStudents: { $ne: studentId } },
            {
                $push: { enrolledStudents: studentId },
                $inc: { "stats.enrollmentCount": 1 },
            }
        );

        if (result.modifiedCount === 0) {
            results.push({ course_id, status: "Already enrolled" });
            continue;
        }

        await User.findByIdAndUpdate(studentId, { $addToSet: { Courses: course_id } });
        results.push({ course_id, status: "Enrolled" });
    }

    return results;
};

export { enrollStudentInCourses };
