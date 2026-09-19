import {Router} from 'express'
import rateLimit from "express-rate-limit";
import { requireRole, verifyAuth } from "../../middleware/auth.js";
import { ROLES } from "../../models/user.model.js";

import { upload, uploadVideo } from "../../middleware/multer.middleware.js";
import { requireCourseOwner } from "../../middleware/requireCourseOwner.js";
import { requireEnrollment } from "../../middleware/requireEnrollment.js";
import { validate } from "../../middleware/validate.js";
import { ApiError } from "../../utils/ApiError.js";
import { env } from "../../config/env.js";
import { askLectureSchema } from "../../validation/lecture.schemas.js";
import { addLecture, askLecture, deleteLecture, getAllLectures, getLectureById, getLecturesCompleted, markLectureCompleted, updateLecture, uploadTranscript } from '../../controllers/Courses/Lecture.controller.js';


const router = Router()

// Each call embeds a query and runs a real chat-completion — real cost and
// quota against the HF free tier, not a cheap DB read, so this gets its own
// (tighter) limit rather than riding on the auth limiter's budget. Same
// skip-in-e2e reasoning as middleware/rateLimit.js's authLimiter.
const skipInE2E = () => env.e2eTestRoutes && !env.isProduction;
const askLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipInE2E,
    handler: (req, res, next) => next(new ApiError(429, "Too many questions. Please wait a moment before asking another.")),
});

// Lectures
// Lectures
router.route('/:course_id/modules/:moduleId/lectures')
    .post(verifyAuth, requireRole(ROLES.TEACHER), requireCourseOwner('module'), uploadVideo.single('videourl'), addLecture) // Add a lecture to a module
    .get(verifyAuth, getAllLectures); // Get all lectures for a module

router.route('/:course_id/modules/:moduleId/lectures/:lecture_id')
    .get(verifyAuth, requireEnrollment('lecture'), getLectureById) // Get a specific lecture
    .delete(verifyAuth, requireRole(ROLES.TEACHER), requireCourseOwner('lecture'), deleteLecture) // Delete a lecture
    .put(verifyAuth, requireRole(ROLES.TEACHER), requireCourseOwner('lecture'), updateLecture) // update a lecture

router.route('/:course_id/modules/:moduleId/lectures/:lecture_id/transcript')
    .post(verifyAuth, requireRole(ROLES.TEACHER), requireCourseOwner('lecture'), upload.single('transcript'), uploadTranscript); // Upload/replace a lecture's transcript

// Deliberately flat — not nested under /:course_id/modules/:moduleId like
// its siblings above. The chat panel (features/learn, frontend) only ever
// has courseId + itemId (== this lecture's _id, per curriculum/sync.js's
// "same _id as the Lecture document"), never a moduleId; requireEnrollment's
// lecture resolver (courseContext.js) already derives module and course by
// walking UP from lecture_id, so nothing here actually needs them supplied.
router.route('/lectures/:lecture_id/ask')
    .post(verifyAuth, requireEnrollment('lecture'), askLimiter, validate(askLectureSchema), askLecture); // Ask the RAG chat assistant a question about this lecture

router.route('/:courseId/lectures/:lectureId/complete')
    .post(verifyAuth, requireRole(ROLES.STUDENT), requireEnrollment('course'), markLectureCompleted); // Mark lecture as completed
router.route('/:courseId/completed').get(verifyAuth, requireRole(ROLES.STUDENT),getLecturesCompleted);
export default router