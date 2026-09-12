import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as assignmentService from "../../services/assignment.service.js";

// req.course / req.module / req.assignment were resolved AND authorized by the
// route's requireCourseOwner or requireEnrollment guard.

const createAssignment = asyncHandler(async (req, res) => {
    const { title, deadline } = req.body;
    const files = req.files?.assignmentFiles;

    if (!title) throw new ApiError(400, "Title cannot be empty");
    if (!files || files.length === 0) throw new ApiError(400, "No assignments uploaded");

    const assignment = await assignmentService.createAssignment(req.course, req.module, {
        title,
        deadline,
        files,
    });

    return res.status(200).json(
        new ApiResponse(200, assignment, "Assignment successfully created and linked to the module")
    );
});

const submitAssignment = asyncHandler(async (req, res) => {
    const files = req.files?.submissionFiles;

    if (!files || files.length === 0) throw new ApiError(400, "no assignments uploaded");

    await assignmentService.submitAssignment(req.assignment, {
        studentId: req.student._id,
        files,
    });

    return res.status(200).json(new ApiResponse(200, {}, "submittedAssignment Succesfully"));
});

const getAssignmentById = asyncHandler(async (req, res) => {
    const assignment = await assignmentService.getAssignmentForStudent(
        req.assignment._id,
        req.student._id
    );

    return res.status(200).json(new ApiResponse(200, assignment, "Assignment sent succesfully"));
});

const deleteAssignment = asyncHandler(async (req, res) => {
    await assignmentService.deleteAssignmentWithMedia(req.course, req.module, req.assignment);

    return res.status(200).json(new ApiResponse(200, null, "Assignment deleted succesfully"));
});

const getStudentsAndUploadedAssignments = asyncHandler(async (req, res) => {
    const submissions = await assignmentService.getSubmissions(req.assignment);

    return res.status(200).json(
        new ApiResponse(200, submissions, "Students and Their Assignments sent Succesfully")
    );
});

const markAssignmentCompleted = asyncHandler(async (req, res) => {
    const { courseId, assignmentId } = req.params;

    await assignmentService.markAssignmentCompleted({
        studentId: req.student?._id,
        courseId,
        assignmentId,
    });

    return res.status(200).json(new ApiResponse(200, true, "Marked Assignment as Completed"));
});

export {
    createAssignment,
    submitAssignment,
    deleteAssignment,
    getAssignmentById,
    markAssignmentCompleted,
    getStudentsAndUploadedAssignments
}
