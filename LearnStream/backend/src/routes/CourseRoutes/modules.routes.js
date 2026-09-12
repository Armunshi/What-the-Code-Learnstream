import {Router} from 'express'

import { verifyJWT } from "../../middleware/authteacher.middleware.js";
import { verifyJWTCombined } from "../../middleware/authcombined.middleware.js";
import { requireCourseOwner } from "../../middleware/requireCourseOwner.js";
import { addModule, deleteModule, getCourseModules, getModuleById, updateModule } from '../../controllers/Courses/Modules.controller.js';
const router = Router()
// Modules
router.route('/:course_id/modules')
    .post(verifyJWT, requireCourseOwner('course'), addModule) // Create a new module
    .get(verifyJWTCombined, getCourseModules); // Get all modules for a course

router.route('/:courseId/modules/:module_id')
    .get(verifyJWTCombined, getModuleById) // Get a specific module
    .put(verifyJWT, requireCourseOwner('module'), updateModule) // Update a module
    .delete(verifyJWT, requireCourseOwner('module'), deleteModule); // Delete a module
export default router