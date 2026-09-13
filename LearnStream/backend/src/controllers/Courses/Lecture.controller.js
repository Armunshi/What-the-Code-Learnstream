import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import * as lectureService from "../../services/lecture.service.js";

// req.course / req.module / req.lecture were resolved AND authorized by the
// route's requireCourseOwner or requireEnrollment guard. Nothing here
// re-fetches or re-checks them.

const addLecture = asyncHandler(async (req, res) => {
    const { title } = req.body;
    const videoLocalPath = req.file?.path;

    if (!title) throw new ApiError(400, "Missing required field: title");
    if (!videoLocalPath) throw new ApiError(400, "File not uploaded");

    const lecture = await lectureService.addLectureToModule(req.course, req.module, {
        title,
        videoLocalPath,
    });

    return res.status(200).json(new ApiResponse(200, lecture, "Added lecture successfully"));
});

const updateLecture = asyncHandler(async (req, res) => {
    const { title, enableFreePreview } = req.body;

    const lecture = await lectureService.updateLectureDetails(req.lecture, {
        title,
        enableFreePreview,
        videoLocalPath: req.file?.path,
    });

    return res.status(200).json(new ApiResponse(200, lecture, "Lecture updated successfully"));
});

const deleteLecture = asyncHandler(async (req, res) => {
    await lectureService.deleteLectureWithMedia(req.course, req.module, req.lecture);

    return res.status(200).json(new ApiResponse(200, null, "Lecture deleted succesfully"));
});

const getAllLectures = asyncHandler(async (req, res) => {
    const { moduleId } = req.params;

    const lectures = await lectureService.listModuleLectures(moduleId);

    return res.status(200).json(new ApiResponse(200, lectures, "All lectures retrieved successfully"));
});

const getLectureById = asyncHandler(async (req, res) => {
    // requireEnrollment('lecture') already resolved it, and refused the request
    // unless the caller owns or is enrolled in the course — this route returns
    // videourl and public_id (BACKEND_AUDIT.md §1.1).
    return res.status(200).json(new ApiResponse(200, req.lecture, "Lecture retrieved successfully"));
});

const markLectureCompleted = asyncHandler(async (req, res) => {
    const { courseId, lectureId } = req.params;

    const progress = await lectureService.markLectureCompleted({
        studentId: req.user._id,
        courseId,
        lectureId,
    });

    return res.status(200).json(new ApiResponse(200, progress, "Marked Lecture as Completed"));
});

const getLecturesCompleted = asyncHandler(async (req, res) => {
    const { courseId } = req.params;
    const studentId = req.user._id;

    if (!studentId) throw new ApiError(401, "Unauthorized access");

    const completed = await lectureService.getCompletedLectures({ studentId, courseId });

    return res.status(200).json(
        completed.length === 0
            ? new ApiResponse(200, [], "No lectures completed yet")
            : new ApiResponse(200, completed, "Completed lectures fetched successfully")
    );
});

export {
    addLecture,
    updateLecture,
    deleteLecture,
    getLectureById,
    getAllLectures,
    markLectureCompleted,
    getLecturesCompleted,
}
