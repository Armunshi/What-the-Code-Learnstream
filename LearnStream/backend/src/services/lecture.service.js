import { ApiError } from "../utils/ApiError.js";
import { Courses } from "../models/course.model.js";
import { Lectures } from "../models/lecture.model.js";
import { Modules } from "../models/module.model.js";
import { Progress } from "../models/progress.model.js";
import { deleteMediaFromCloudinary, uploadOnCloudinary } from "./media.service.js";

/** Uploads the video, creates the lecture, and links it from module and course. */
export const addLectureToModule = async (course, module, { title, videoLocalPath }) => {
    const video = await uploadOnCloudinary(videoLocalPath);
    if (!video?.secure_url) {
        throw new ApiError(400, "Video was not uploaded properly to Cloudinary");
    }

    const lecture = await Lectures.create({
        title,
        videourl: video.secure_url,
        duration: video.duration,
        public_id: video.public_id,
        // Stored at upload time because Cloudinary's destroy() defaults to
        // resource_type "image" and silently no-ops on anything else (§2.4).
        resource_type: video.resource_type,
        module_id: module._id,
    });

    const [updatedCourse, updatedModule] = await Promise.all([
        Courses.findByIdAndUpdate(course._id, { $push: { lectures: lecture._id } }, { new: true }),
        Modules.findByIdAndUpdate(module._id, { $push: { lectures: lecture._id } }, { new: true }),
    ]);

    if (!updatedCourse || !updatedModule) {
        throw new ApiError(404, "Course/Module not found or failed to update");
    }

    return lecture;
};

export const updateLectureDetails = async (lecture, { title, enableFreePreview, videoLocalPath }) => {
    if (title) lecture.title = title;
    if (typeof enableFreePreview === "boolean") lecture.freePreview = enableFreePreview;

    if (videoLocalPath) {
        // Old asset first: if the upload then fails, we have lost the replaced
        // video rather than orphaned a paid-for asset nobody can reach.
        await deleteMediaFromCloudinary(lecture.public_id, lecture.resource_type);

        const video = await uploadOnCloudinary(videoLocalPath);
        lecture.videourl = video.secure_url;
        lecture.public_id = video.public_id;
        lecture.resource_type = video.resource_type;
        lecture.duration = video.duration;
    }

    await lecture.save();
    return lecture;
};

/** Deletes a lecture, its Cloudinary asset, and the ids pointing at it. */
export const deleteLectureWithMedia = async (course, module, lecture) => {
    await deleteMediaFromCloudinary(lecture.public_id, lecture.resource_type);

    course.lectures = course.lectures.filter((id) => !id.equals(lecture._id));
    await course.save();

    module.lectures = module.lectures.filter((id) => !id.equals(lecture._id));
    await module.save();

    await Lectures.findByIdAndDelete(lecture._id);
};

export const listModuleLectures = async (moduleId) => {
    const module = await Modules.findById(moduleId).populate({
        path: "lectures",
        select: "_id title duration freePreview",
    });

    if (!module) throw new ApiError(404, "Module not found");
    return module.lectures;
};

export const getLecture = async (lectureId) => {
    const lecture = await Lectures.findById(lectureId);
    if (!lecture) throw new ApiError(404, "Lecture not found");
    return lecture;
};

/**
 * Records a lecture completion, at most once, under concurrent requests.
 *
 * A findOne-then-push races: two simultaneous requests both read "not
 * completed" and both push, producing two rows for one lecture with a 200 and
 * no error (BACKEND_AUDIT.md §3.8). The checkbox double-fire bug makes that a
 * routinely observed scenario, not a hypothetical.
 *
 * So: get-or-create the Progress document atomically, then push under a `$ne`
 * filter that is itself the uniqueness check. `$addToSet` cannot be used here
 * — it compares whole subdocuments, and `completedAt` differs every request,
 * so every entry would look unique to it (§10.3).
 */
export const markLectureCompleted = async ({ studentId, courseId, lectureId }) => {
    await Progress.findOneAndUpdate(
        { studentId, courseId },
        { $setOnInsert: { studentId, courseId } },
        { upsert: true }
    );

    return (
        (await Progress.findOneAndUpdate(
            { studentId, courseId, "completedLectures.lectureId": { $ne: lectureId } },
            {
                $push: { completedLectures: { lectureId, completedAt: Date.now() } },
                $inc: { completedLectureCount: 1 },
                $set: { lastUpdated: Date.now() },
            },
            { new: true }
        )) ?? (await Progress.findOne({ studentId, courseId }))
    );
};

export const getCompletedLectures = async ({ studentId, courseId }) => {
    const progress = await Progress.findOne({ studentId, courseId });
    if (!progress) return [];

    return progress.completedLectures.map((lecture) => ({ lectureId: lecture.lectureId }));
};
