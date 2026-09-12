import {Router} from 'express'
import { requireRole, verifyAuth } from "../../middleware/auth.js";
import { ROLES } from "../../models/user.model.js";
import { upload } from "../../middleware/multer.middleware.js";

import { requireCourseOwner } from "../../middleware/requireCourseOwner.js";
import { addModule, addModulesBulk, deleteModule, getCourseModules, getModuleById, updateModule } from '../../controllers/Courses/Modules.controller.js';
const router = Router()
// Modules
router.route('/:course_id/modules')
    .post(verifyAuth, requireRole(ROLES.TEACHER), requireCourseOwner('course'), addModule) // Create a new module
    .get(verifyAuth, getCourseModules); // Get all modules for a course

// One request creates every module, lecture and assignment the teacher
// submitted, or none of them (BACKEND_AUDIT.md §3.20). upload.any() rather
// than upload.fields(): the number of lecture/assignment file fields varies
// per submission, so a fixed field list can't be declared up front.
router.route('/:course_id/modules/bulk')
    .post(verifyAuth, requireRole(ROLES.TEACHER), requireCourseOwner('course'), upload.any(), addModulesBulk);

router.route('/:courseId/modules/:module_id')
    .get(verifyAuth, getModuleById) // Get a specific module
    .put(verifyAuth, requireRole(ROLES.TEACHER), requireCourseOwner('module'), updateModule) // Update a module
    .delete(verifyAuth, requireRole(ROLES.TEACHER), requireCourseOwner('module'), deleteModule); // Delete a module
export default router