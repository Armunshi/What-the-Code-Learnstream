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
 } from "../../controllers/Courses/Course.controller.js";

import { upload } from "../../middleware/multer.middleware.js";
import { requireCourseOwner } from "../../middleware/requireCourseOwner.js";
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
router.route('/').post(verifyAuth, requireRole(ROLES.TEACHER), upload.single('thumbnail'), createCourse);

//  Dynamic Routes NEXT (Keep These At Bottom)
router.route('/:courseId/getTeacher').get(getCourseOwner);
router.route('/:courseId/enrolled').get(verifyAuth, checkEnrollment);
router.route('/:courseId/progress').get(verifyAuth, CourseProgress);
router.route('/:courseId/students').get(verifyAuth, requireRole(ROLES.TEACHER), requireCourseOwner('course'), getEnrolledStudents);
router.route('/:courseId').get(getCourseById); // LAST


// Course Cart 

// Assignments
// router.route('/:course_id/free-previews').get( verifyAuth, requireRole(ROLES.TEACHER), getFreePreviews);lecture_

export default router