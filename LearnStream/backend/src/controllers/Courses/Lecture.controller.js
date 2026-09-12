import { Courses } from "../../models/course.model.js";
import { Lectures } from "../../models/lecture.model.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { deleteMediaFromCloudinary, uploadOnCloudinary } from "../../utils/cloudinary.js";
import { Progress } from "../../models/progress.model.js";
import { Modules } from "../../models/module.model.js";

const addLecture = asyncHandler(async (req, res) => {
    const { title } = req.body;

    if (!title) {
        throw new ApiError(400, 'Missing required field: title');
    }

    // Resolved and authorized by requireCourseOwner('module'). The course is
    // the module's real parent, not whatever the URL claimed it was.
    const course = req.course;
    const module = req.module;

    const videoLocalPath = req.file?.path;

    if (!videoLocalPath) {
        throw new ApiError(400, 'File not uploaded');
    }

    // Upload to Cloudinary
    const video = await uploadOnCloudinary(videoLocalPath);
    const videoUrl = video.secure_url;
    if (!videoUrl) {
        throw new ApiError(400, 'Video was not uploaded properly to Cloudinary');
    }

    const video_public_id = video.public_id;
    const video_duration = video.duration;

    // Create a new lecture
    const lecture = await Lectures.create({
        title,
        videourl: videoUrl,
        duration: video_duration,
        public_id: video_public_id,
        resource_type: video.resource_type,
        module_id: module._id
    });

    if (!lecture) {
        throw new ApiError(500, 'Lecture was not added');
    }

    // Update related course and module
    const updatedCourse = await Courses.findByIdAndUpdate(
        course._id,
        { $push: { lectures: lecture._id } },
        { new: true }
    );
    const updatedModule = await Modules.findByIdAndUpdate(
        module._id,
        { $push: { lectures: lecture._id } },
        { new: true }
    );
    if (!updatedCourse || !updatedModule) {
        throw new ApiError(404, 'Course/Module not found or failed to update');
    }

    return res.status(200).json(
        new ApiResponse(200, lecture, 'Added lecture successfully')
    );
});


const updateLecture = asyncHandler(async (req, res) => {
    const { title, enableFreePreview } = req.body;

    // Resolved and authorized by requireCourseOwner('lecture') — the course
    // checked is the one that actually owns this lecture, so a teacher can no
    // longer edit another teacher's lecture by naming their own course in the
    // URL.
    const lecture = req.lecture;

    if (title) lecture.title = title;
    if (typeof enableFreePreview === "boolean") {
        lecture.freePreview = enableFreePreview;
    }

    // Handle video replacement if a new video file is uploaded
    if (req.file?.path) {
        await deleteMediaFromCloudinary(lecture.public_id, lecture.resource_type);

        const video = await uploadOnCloudinary(req.file.path);
        lecture.videourl = video.secure_url;
        lecture.public_id = video.public_id;
        lecture.resource_type = video.resource_type;
        lecture.duration = video.duration;
    }

    await lecture.save();
    return res.status(200).json(
        new ApiResponse(200, lecture, "Lecture updated successfully")
    );
});
const deleteLecture = asyncHandler(async (req,res)=>{
    // Resolved and authorized by requireCourseOwner('lecture'). Previously
    // ownership was asserted against the course_id in the URL while the delete
    // targeted lecture_id, with nothing checking the two were related — any
    // teacher who owned any course could delete any lecture, and its Cloudinary
    // asset, by pairing their own course_id with someone else's lecture_id.
    const { course, module, lecture } = req;

    await deleteMediaFromCloudinary(lecture.public_id, lecture.resource_type);

    course.lectures = course.lectures.filter((id) => !id.equals(lecture._id));
    await course.save();

    module.lectures = module.lectures.filter((id) => !id.equals(lecture._id));
    await module.save();

    await Lectures.findByIdAndDelete(lecture._id);

    return res.status(200)
    .json(new ApiResponse(200,null,"Lecture deleted succesfully"))
})
const getAllLectures = asyncHandler(async (req, res) => {
    const { moduleId } = req.params;

    const module = await Modules.findById(moduleId).populate({
        path: "lectures",
        select: "_id title duration freePreview",
    });

    if (!module) {
        throw new ApiError(404, "Module not found");
    }

    return res.status(200).json(
        new ApiResponse(200, module.lectures, "All lectures retrieved successfully")
    );
});
// when user wants to view a particular lecture
const getLectureById = asyncHandler(async (req, res) => {
    const { moduleId, lecture_id } = req.params;

    const module = await Modules.findById(moduleId);
    if (!module) {
        throw new ApiError(404, "Module not found");
    }

    const lecture = await Lectures.findById(lecture_id);
    if (!lecture) {
        throw new ApiError(404, "Lecture not found");
    }

    return res.status(200).json(
        new ApiResponse(200, lecture, "Lecture retrieved successfully")
    );
});
const markLectureCompleted = asyncHandler(async (req, res) => {
    const { courseId, lectureId } = req.params;
    const studentId = req.student?._id;

    // A bare findOne-then-push has a race under concurrent requests, which
    // silently double-enters: two completedLectures rows for the same
    // lecture, 200 OK, no error, corrupted data (BACKEND_AUDIT.md §3.8).
    // Get-or-create the Progress doc atomically first, then record the
    // completion in a single atomic findOneAndUpdate whose `$ne` filter is
    // what enforces uniqueness on `lectureId`. $addToSet is NOT usable here:
    // it compares whole subdocuments, and `completedAt` differs on every
    // request, so every entry would look unique to it.
    await Progress.findOneAndUpdate(
        { studentId, courseId },
        { $setOnInsert: { studentId, courseId } },
        { upsert: true }
    );

    const progress = await Progress.findOneAndUpdate(
        { studentId, courseId, "completedLectures.lectureId": { $ne: lectureId } },
        {
            $push: { completedLectures: { lectureId, completedAt: Date.now() } },
            $inc: { completedLectureCount: 1 },
            $set: { lastUpdated: Date.now() },
        },
        { new: true }
    ) ?? await Progress.findOne({ studentId, courseId });

    return res.status(200).json(new ApiResponse(200, progress, "Marked Lecture as Completed"));
});


const getLecturesCompleted  = asyncHandler(async (req,res)=>{
    const { courseId } = req.params;
    const studentId = req.student?._id; // Ensure authentication middleware sets req.student

    if (!studentId) {
        throw new ApiError(401, "Unauthorized access");
    }

    // Fetch completed lectures for the student in the given course
    const progress = await Progress.findOne({ studentId, courseId });

    if (!progress) {
        return res.status(200).json(new ApiResponse(200, [], "No lectures completed yet"));
    }

    const completedLectureIds = progress.completedLectures.map(lecture => ({ lectureId: lecture.lectureId }));

    return res.status(200).json(new ApiResponse(200, completedLectureIds, "Completed lectures fetched successfully"));
})
export {
    addLecture,
    updateLecture,
    deleteLecture,
    getLectureById,
    getAllLectures,
    markLectureCompleted,
    getLecturesCompleted,
}