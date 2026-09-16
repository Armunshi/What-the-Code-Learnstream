import { Router } from "express";
import { requireRole, verifyAuth } from "../../middleware/auth.js";
import { ROLES } from "../../models/user.model.js";
import { addToCart, getCart, inCart, mergeCart, removeFromCart } from "../../controllers/cart.controller.js";

// Cart endpoints (plan's W1-COM task list, docs/contracts/api-conventions.md
// D10). Mounted at /courses, ahead of the legacy CourseRouter (app.js), so
// these win over the pre-existing /courses/cart* routes still registered in
// routes/CourseRoutes/courses.routes.js (owned by CAT) — see
// controllers/cart.controller.js's own comment for why that duplication
// exists rather than this lane editing a file it doesn't own.
//
// "/cart/merge" is registered before "/cart/:courseId" — both are POSTs
// that would otherwise collide, since Express matches by registration
// order and "/cart/:courseId" would swallow "merge" as a courseId.
const router = Router();

router.get("/cart", verifyAuth, requireRole(ROLES.STUDENT), getCart);
router.post("/cart/merge", verifyAuth, requireRole(ROLES.STUDENT), mergeCart);
router
    .route("/cart/:courseId")
    .get(verifyAuth, requireRole(ROLES.STUDENT), inCart)
    .post(verifyAuth, requireRole(ROLES.STUDENT), addToCart)
    .delete(verifyAuth, requireRole(ROLES.STUDENT), removeFromCart);

export default { basePath: "/courses", priority: 10, router };
