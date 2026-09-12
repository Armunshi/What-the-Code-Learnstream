import { Router } from 'express';
import { requireRole, verifyAuth } from "../../middleware/auth.js";
import { ROLES } from "../../models/user.model.js";


import { upload } from '../../middleware/multer.middleware.js';
import { requireCourseOwner } from "../../middleware/requireCourseOwner.js";
import { requireEnrollment } from "../../middleware/requireEnrollment.js";
import { createAssignment, deleteAssignment, getAssignmentById, getStudentsAndUploadedAssignments, markAssignmentCompleted, submitAssignment  } from '../../controllers/Courses/Assignment.controller.js';

const router = Router()

// Assignments
router.route('/:course_id/modules/:moduleId/assignments')
    .post(
        verifyAuth, requireRole(ROLES.TEACHER),
        requireCourseOwner('module'),
        upload.fields([{ name: 'assignmentFiles', maxCount: 10 }]),
        createAssignment
    ); // Create a new assignment for a module
router.route('/:courseId/assignments/:assignmentId/upload')
    .post(
        verifyAuth, requireRole(ROLES.STUDENT),
        requireEnrollment('assignment'),
        upload.fields([{ name: 'submissionFiles', maxCount: 10 }]),
        submitAssignment
    ); // Submit an assignment

router.route('/:courseId/assignment/:assignmentId')
.get(verifyAuth, requireRole(ROLES.TEACHER), requireCourseOwner('assignment'), getStudentsAndUploadedAssignments)
router.route('/:courseId/assignments/:assignmentId')
.get(verifyAuth, requireRole(ROLES.STUDENT), requireEnrollment('assignment'), getAssignmentById);
router.route('/:courseId/modules/:moduleId/assignments/:assignmentId')
    .delete(verifyAuth, requireRole(ROLES.TEACHER), requireCourseOwner('assignment'), deleteAssignment);
    router.route('/:courseId/assignments/:assignmentId/complete')
    .post(verifyAuth, requireRole(ROLES.STUDENT), requireEnrollment('assignment'), markAssignmentCompleted);
    
export default router;