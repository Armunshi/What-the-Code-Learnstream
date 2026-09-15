import { Router } from "express";
import { requireRole, verifyAuth } from "../../middleware/auth.js";
import { ROLES } from "../../models/user.model.js";
import {
    checkEnrollment,
    CourseProgress,
    createCourse,
    getAllCourses,
    getCourseById,
    getCourseByStudentId,
    getCourseByTeacherId,
    getCourseOwner,
    getCoursesByCategory,
    getEnrolledStudents,
    updateCourseStatus,
 } from "../../controllers/Courses/Course.controller.js";

import { upload } from "../../middleware/multer.middleware.js";
import { requireCourseOwner } from "../../middleware/requireCourseOwner.js";
import { requireEnrollment } from "../../middleware/requireEnrollment.js";
import { addToCart, getCart, inCart, removeFromCart } from "../../controllers/Courses/cart.controller.js";
const router = Router();

//  Cart Routes
router.route('/cart').get(verifyAuth, requireRole(ROLES.STUDENT), getCart);
router.route('/cart/:courseId')
      .post(verifyAuth, requireRole(ROLES.STUDENT), addToCart)
      .delete(verifyAuth, requireRole(ROLES.STUDENT), removeFromCart)
      .get(verifyAuth, requireRole(ROLES.STUDENT), inCart);

//  Static Routes FIRST
router.route('/getallCourses').get(getAllCourses);
router.route('/student/:student_id').get(verifyAuth, requireRole(ROLES.STUDENT), getCourseByStudentId);
router.route('/teacher/:teacher_id').get(verifyAuth, requireRole(ROLES.TEACHER), getCourseByTeacherId);
router.route('/').get(getCoursesByCategory); // category filter
router.route('/').post(
    verifyAuth,
    requireRole(ROLES.TEACHER),
    upload.fields([{ name: 'thumbnail', maxCount: 1 }, { name: 'promoVideo', maxCount: 1 }]),
    createCourse
);

//  Dynamic Routes NEXT (Keep These At Bottom)
router.route('/:courseId/getTeacher').get(getCourseOwner);
router.route('/:courseId/enrolled').get(verifyAuth, checkEnrollment);
router.route('/:courseId/status').patch(verifyAuth, requireRole(ROLES.TEACHER), requireCourseOwner('course'), updateCourseStatus);
// Previously just verifyAuth — any authenticated caller, enrolled or not,
// got an answer (silently "0%" instead of a 403) rather than a signal that
// they aren't entitled to this course's progress at all (BACKEND_AUDIT.md-
// style gap, closed here the same way markLectureCompleted/
// markAssignmentCompleted already guard their own routes below).
router.route('/:courseId/progress').get(verifyAuth, requireRole(ROLES.STUDENT), requireEnrollment('course'), CourseProgress);
router.route('/:courseId/students').get(verifyAuth, requireRole(ROLES.TEACHER), requireCourseOwner('course'), getEnrolledStudents);
router.route('/:courseId').get(getCourseById); // LAST


// Course Cart 

// Assignments
// router.route('/:course_id/free-previews').get( verifyAuth, requireRole(ROLES.TEACHER), getFreePreviews);lecture_

export default router