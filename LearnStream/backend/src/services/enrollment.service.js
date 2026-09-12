import { Courses } from "../models/course.model.js";
import { UserStudent } from "../models/user/userstudentmodel.js";

// Enrolls a student in each of `course_ids`, skipping ones that no longer
// exist or the student is already enrolled in. Shared by the manual-enroll
// endpoint and the payment-verification flow so both enroll the same way.
const enrollStudentInCourses = async (studentId, course_ids) => {
    const student = await UserStudent.findById(studentId);
    if (!student) {
        throw new Error("Student not found");
    }

    const results = [];

    for (const course_id of course_ids) {
        const course = await Courses.findById(course_id);
        if (!course) {
            results.push({ course_id, status: "Course not found" });
            continue;
        }

        const alreadyEnrolled = student.Courses.includes(course_id.toString());
        if (alreadyEnrolled) {
            results.push({ course_id, status: "Already enrolled" });
            continue;
        }

        await Courses.findByIdAndUpdate(course_id, {
            $push: { enrolledStudents: studentId },
        });
        await UserStudent.findByIdAndUpdate(studentId, {
            $push: { Courses: course_id },
        });

        results.push({ course_id, status: "Enrolled" });
    }

    return results;
};

export { enrollStudentInCourses };
