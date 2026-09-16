// New cart controller (docs/lanes/com.json owns "backend/src/controllers/
// cart.controller.js"). The manifest's literal path doesn't match where the
// pre-existing cart controller actually lives
// (controllers/Courses/cart.controller.js, owned by CAT via
// routes/CourseRoutes/courses.routes.js) — flagged as a needed manifest
// amendment in this lane's final report. Rather than edit a file outside
// this lane's ownership, this is a fresh implementation at the manifest's
// literal path, wired up through this lane's own routes/features/
// cart.routes.js, which mounts ahead of the legacy CourseRouter and so
// wins every request for these paths (docs/contracts/api-conventions.md
// "Route mounting") — the old controller/routes become dead code, still
// present but never reached.
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Cart } from "../models/cart.model.js";
import { Courses } from "../models/course.model.js";
import { toCourseCardDTOs } from "../utils/dto/courseCard.js";

const isSameId = (a, b) => Boolean(a) && Boolean(b) && a.toString() === b.toString();

/**
 * Cart items rendered as CourseCardDTOs (docs/contracts/dto.md) — the same
 * shape the guest cart stores client-side (useCart().add() takes a full
 * CourseCardDTO), so CartButton/CartPage render identically regardless of
 * `useCart().mode`.
 */
const getCartDTO = async (studentId) => {
    const cart = await Cart.findOne({ user: studentId }).populate({
        path: "items.course",
        populate: { path: "author", select: "name username" },
    });

    // A course deleted after being carted leaves a populate() null in its
    // slot — filtered out rather than left to crash toCourseCardDTOs.
    const courses = (cart?.items ?? []).map((item) => item.course).filter(Boolean);
    return { items: toCourseCardDTOs(courses) };
};

// GET /courses/cart — 200 with an empty list rather than 404 when the
// student has no cart document yet (a brand-new student's empty cart is not
// an error condition).
const getCart = asyncHandler(async (req, res) => {
    const dto = await getCartDTO(req.user._id);
    return res.status(200).json(new ApiResponse(200, dto, "Cart fetched successfully"));
});

// POST /courses/cart/:courseId — checks (docs/contracts/api-conventions.md
// "Free enrollment (D10)"): the course exists, the student isn't already
// enrolled in it, and it isn't free (free courses never enter a cart — the
// same FREE_COURSE_ENROLL_DIRECTLY code createOrder uses, since it's the
// same underlying rule: a free course is enrolled directly, never bought).
// Idempotent: adding a course already in the cart is a no-op 200, not a 409
// — consistent with mergeCart's idempotency below rather than surprising a
// caller that retries a click.
const addToCart = asyncHandler(async (req, res) => {
    const studentId = req.user._id;
    const { courseId } = req.params;

    const course = await Courses.findById(courseId).select("price status enrolledStudents");
    if (!course) {
        throw new ApiError(404, "Course not found");
    }
    if (course.price === 0) {
        return res.status(400).json({ code: "FREE_COURSE_ENROLL_DIRECTLY" });
    }
    const alreadyEnrolled = (course.enrolledStudents ?? []).some((id) => isSameId(id, studentId));
    if (alreadyEnrolled) {
        throw new ApiError(400, "You're already enrolled in this course");
    }

    let cart = await Cart.findOne({ user: studentId });
    const alreadyInCart = cart?.items?.some((item) => isSameId(item.course, courseId));
    if (!alreadyInCart) {
        cart = await Cart.findOneAndUpdate(
            { user: studentId },
            { $push: { items: { course: courseId } } },
            { upsert: true, new: true }
        );
    }

    const dto = await getCartDTO(studentId);
    return res.status(200).json(new ApiResponse(200, dto, "Course added to cart"));
});

const removeFromCart = asyncHandler(async (req, res) => {
    const studentId = req.user._id;
    const { courseId } = req.params;

    await Cart.findOneAndUpdate({ user: studentId }, { $pull: { items: { course: courseId } } });

    const dto = await getCartDTO(studentId);
    return res.status(200).json(new ApiResponse(200, dto, "Course removed from cart"));
});

const inCart = asyncHandler(async (req, res) => {
    const studentId = req.user._id;
    const { courseId } = req.params;

    const cart = await Cart.findOne({ user: studentId }).select("items");
    const courseExists = (cart?.items ?? []).some((item) => isSameId(item.course, courseId));

    return res.status(200).json(new ApiResponse(200, { inCart: courseExists }, "Course presence checked"));
});

// POST /courses/cart/merge {courseIds} — the guest-cart-to-server-cart merge
// on login (plan §2.3). Skips a course id that no longer exists, one the
// student is already enrolled in, or a free one (same three checks as
// addToCart, applied per-id instead of one-at-a-time).
//
// Idempotent by construction: courses already present in the student's cart
// are filtered out in JS before the write, so calling this twice with the
// same courseIds is a no-op the second time. A literal Mongo $addToSet
// wouldn't actually give that guarantee here — every array item is a
// subdocument with its own auto-generated `_id` (cart.model.js, not owned by
// this lane), so two pushes of "the same" {course} object are never
// deep-equal to $addToSet and both would land.
const mergeCart = asyncHandler(async (req, res) => {
    const studentId = req.user._id;
    const { courseIds } = req.body;

    if (!Array.isArray(courseIds)) {
        throw new ApiError(400, "courseIds (array) is required");
    }

    const uniqueIds = [...new Set(courseIds.filter(Boolean).map(String))];

    if (uniqueIds.length > 0) {
        const [courses, cart] = await Promise.all([
            Courses.find({ _id: { $in: uniqueIds } }).select("price status enrolledStudents"),
            Cart.findOne({ user: studentId }).select("items"),
        ]);

        const existingIds = new Set((cart?.items ?? []).map((item) => item.course.toString()));

        const eligibleIds = courses
            .filter((course) => course.price > 0)
            .filter((course) => !(course.enrolledStudents ?? []).some((id) => isSameId(id, studentId)))
            .map((course) => String(course._id))
            .filter((id) => !existingIds.has(id));

        if (eligibleIds.length > 0) {
            await Cart.findOneAndUpdate(
                { user: studentId },
                { $push: { items: { $each: eligibleIds.map((course) => ({ course })) } } },
                { upsert: true }
            );
        }
    }

    const dto = await getCartDTO(studentId);
    return res.status(200).json(new ApiResponse(200, dto, "Cart merged"));
});

export { getCart, addToCart, removeFromCart, inCart, mergeCart };
