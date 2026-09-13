import {Router} from 'express'
import { requireRole, verifyAuth } from "../../middleware/auth.js";
import { ROLES } from "../../models/user.model.js";

import { upload } from "../../middleware/multer.middleware.js";
import { requireCourseOwner } from "../../middleware/requireCourseOwner.js";
import { requireEnrollment } from "../../middleware/requireEnrollment.js";
import { addLecture, deleteLecture, getAllLectures, getLectureById, getLecturesCompleted, markLectureCompleted, updateLecture } from '../../controllers/Courses/Lecture.controller.js';


const router = Router()

// Lectures
// Lectures
router.route('/:course_id/modules/:moduleId/lectures')
    .post(verifyAuth, requireRole(ROLES.TEACHER), requireCourseOwner('module'), upload.single('videourl'), addLecture) // Add a lecture to a module
    .get(verifyAuth, getAllLectures); // Get all lectures for a module

router.route('/:course_id/modules/:moduleId/lectures/:lecture_id')
    .get(verifyAuth, requireEnrollment('lecture'), getLectureById) // Get a specific lecture
    .delete(verifyAuth, requireRole(ROLES.TEACHER), requireCourseOwner('lecture'), deleteLecture) // Delete a lecture
    .put(verifyAuth, requireRole(ROLES.TEACHER), requireCourseOwner('lecture'), updateLecture) // update a lecture

router.route('/:courseId/lectures/:lectureId/complete')
    .post(verifyAuth, requireRole(ROLES.STUDENT), requireEnrollment('course'), markLectureCompleted); // Mark lecture as completed
router.route('/:courseId/completed').get(verifyAuth, requireRole(ROLES.STUDENT),getLecturesCompleted);
export default router