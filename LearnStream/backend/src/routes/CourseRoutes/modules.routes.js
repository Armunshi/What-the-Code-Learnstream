import {Router} from 'express'
import { requireRole, verifyAuth } from "../../middleware/auth.js";
import { ROLES } from "../../models/user.model.js";

import { requireCourseOwner } from "../../middleware/requireCourseOwner.js";
import { addModule, deleteModule, getCourseModules, getModuleById, updateModule } from '../../controllers/Courses/Modules.controller.js';
const router = Router()
// Modules
router.route('/:course_id/modules')
    .post(verifyAuth, requireRole(ROLES.TEACHER), requireCourseOwner('course'), addModule) // Create a new module
    .get(verifyAuth, getCourseModules); // Get all modules for a course

router.route('/:courseId/modules/:module_id')
    .get(verifyAuth, getModuleById) // Get a specific module
    .put(verifyAuth, requireRole(ROLES.TEACHER), requireCourseOwner('module'), updateModule) // Update a module
    .delete(verifyAuth, requireRole(ROLES.TEACHER), requireCourseOwner('module'), deleteModule); // Delete a module
export default router