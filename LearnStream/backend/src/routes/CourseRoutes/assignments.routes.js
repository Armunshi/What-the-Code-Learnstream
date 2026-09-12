import { Router } from 'express';


import { upload } from '../../middleware/multer.middleware.js';
import { verifyJWT } from "../../middleware/authteacher.middleware.js";
import { verifyJWTStudent } from "../../middleware/authstudent.middleware.js";
import { requireCourseOwner } from "../../middleware/requireCourseOwner.js";
import { createAssignment, deleteAssignment, getAssignmentById, getStudentsAndUploadedAssignments, markAssignmentCompleted, submitAssignment  } from '../../controllers/Courses/Assignment.controller.js';

const router = Router()

// Assignments
router.route('/:course_id/modules/:moduleId/assignments')
    .post(
        verifyJWT,
        requireCourseOwner('module'),
        upload.fields([{ name: 'assignmentFiles', maxCount: 10 }]),
        createAssignment
    ); // Create a new assignment for a module
router.route('/:courseId/assignments/:assignmentId/upload')
    .post(
        verifyJWTStudent,
        upload.fields([{ name: 'submissionFiles', maxCount: 10 }]),
        submitAssignment
    ); // Submit an assignment

router.route('/:courseId/assignment/:assignmentId')
.get(verifyJWT, requireCourseOwner('assignment'), getStudentsAndUploadedAssignments)
router.route('/:courseId/assignments/:assignmentId')
.get(verifyJWTStudent,getAssignmentById);
router.route('/:courseId/modules/:moduleId/assignments/:assignmentId')
    .delete(verifyJWT, requireCourseOwner('assignment'), deleteAssignment);
    router.route('/:courseId/assignments/:assignmentId/complete')
    .post(verifyJWTStudent, markAssignmentCompleted);
    
export default router;