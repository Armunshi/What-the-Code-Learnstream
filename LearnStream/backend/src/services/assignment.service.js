import fs from "fs/promises";
import { ApiError } from "../utils/ApiError.js";
import { Assignments } from "../models/assignment.model.js";
import { Modules } from "../models/module.model.js";
import { Progress } from "../models/progress.model.js";
import { deleteMediaFromCloudinary, uploadMultipleFilesOnCloudinary } from "./media.service.js";

export const createAssignment = async (course, module, { title, deadline, files }) => {
    const existing = await Assignments.findOne({
        course_id: course._id,
        module_id: module._id,
        title,
    });
    if (existing) {
        throw new ApiError(409, "Assignment with the same title already exists for this module.");
    }

    const filePaths = files.map((file) => file.path);

    let uploaded;
    try {
        uploaded = await uploadMultipleFilesOnCloudinary(filePaths);
    } catch (error) {
        throw new ApiError(500, "Error uploading files to Cloudinary. Please try again.");
    }

    const assignment = await Assignments.create({
        course_id: course._id,
        module_id: module._id,
        title,
        public_id: uploaded.map((file) => file.public_id),
        // Parallel array to public_id — destroy() needs the real type per file
        // or it silently no-ops on anything that isn't an image (§2.4).
        resourceTypes: uploaded.map((file) => file.resource_type),
        assignmentUrls: uploaded.map((file) => file.secure_url),
        deadline: deadline && !isNaN(new Date(deadline)) ? new Date(deadline) : null,
    });

    const updatedModule = await Modules.findByIdAndUpdate(
        module._id,
        { $push: { assignments: assignment._id } },
        { new: true }
    );
    if (!updatedModule) {
        throw new ApiError(404, "Module not found, assignment not linked.");
    }

    await Promise.allSettled(filePaths.map((path) => fs.unlink(path)));

    return Assignments.findById(assignment._id).select("_id public_id deadline title");
};

/**
 * Records a student's submission.
 *
 * Lateness is decided from the assignment's own stored deadline. It used to be
 * read from the request body, so a student could post any future timestamp and
 * always be recorded on time (BACKEND_AUDIT.md §2.6).
 */
export const submitAssignment = async (assignment, { studentId, files }) => {
    const submittedOnTime = !assignment.deadline || Date.now() <= assignment.deadline.getTime();

    const uploaded = await uploadMultipleFilesOnCloudinary(files.map((file) => file.path));

    await Assignments.findByIdAndUpdate(assignment._id, {
        $push: {
            uploadedAssignments: {
                studentId,
                submittedAssignmentUrls: uploaded.map((file) => file.secure_url),
                uploadedAt: Date.now(),
                submittedOnTime,
            },
        },
    });
};

/** An assignment as one student should see it — their own submissions only. */
export const getAssignmentForStudent = async (assignmentId, studentId) => {
    const assignment = await Assignments.findById(assignmentId).select("-module_id -assignmentUrls");
    if (!assignment) throw new ApiError(404, "The Assignment Requested was not found");

    const plain = assignment.toObject();
    plain.uploadedAssignments = plain.uploadedAssignments.filter(
        (submission) => submission.studentId.toString() === studentId.toString()
    );
    return plain;
};

/** Every submission on an assignment, with submitter names — teacher view. */
export const getSubmissions = async (assignment) => {
    const populated = await assignment.populate({
        path: "uploadedAssignments.studentId",
        select: "name email",
    });

    return {
        assignmentTitle: populated.title,
        uploadedAssignments: populated.uploadedAssignments.map((submission) => ({
            studentId: submission.studentId._id,
            studentName: submission.studentId.name,
            studentEmail: submission.studentId.email,
            submittedAssignmentUrls: submission.submittedAssignmentUrls,
            uploadedAt: submission.uploadedAt,
        })),
    };
};

export const deleteAssignmentWithMedia = async (course, module, assignment) => {
    // allSettled, not forEach with an async callback: that ignored the returned
    // promises, so a rejection became an unhandled rejection and terminated the
    // process on Node 15+ (BACKEND_AUDIT.md §2.5).
    const results = await Promise.allSettled(
        assignment.public_id.map((id, i) =>
            deleteMediaFromCloudinary(id, assignment.resourceTypes?.[i])
        )
    );
    results.forEach((result) => {
        if (result.status === "rejected") {
            console.error("Cloudinary cleanup failed during assignment delete:", result.reason);
        }
    });

    // NOTE: course.assignments is always empty — createAssignment only ever
    // links an assignment to its module, never to the course. This filter is a
    // no-op today and is kept only so it stays correct if that is fixed. See
    // BACKEND_AUDIT.md §3.13.
    course.assignments = course.assignments.filter((id) => !id.equals(assignment._id));
    await course.save();

    module.assignments = module.assignments.filter((id) => !id.equals(assignment._id));
    await module.save();

    await Assignments.findByIdAndDelete(assignment._id);
};

/**
 * Records an assignment completion, at most once under concurrent requests.
 * Same pattern and rationale as lecture.service.js's markLectureCompleted.
 */
export const markAssignmentCompleted = async ({ studentId, courseId, assignmentId }) => {
    await Progress.findOneAndUpdate(
        { studentId, courseId },
        { $setOnInsert: { studentId, courseId } },
        { upsert: true }
    );

    await Progress.findOneAndUpdate(
        { studentId, courseId, "completedAssignments.assignmentId": { $ne: assignmentId } },
        {
            $push: { completedAssignments: { assignmentId, completedAt: Date.now() } },
            $set: { lastUpdated: Date.now() },
        },
        { new: true }
    );
};
