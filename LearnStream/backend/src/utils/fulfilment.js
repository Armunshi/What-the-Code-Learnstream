import { Order } from "../models/Orders.js";
import { Cart } from "../models/cart.model.js";
import { enrollStudentInCourses } from "./enrollment.js";

// The single place an order becomes "paid" and the student becomes enrolled.
//
// Two independent callers reach it: the browser's callback after checkout
// (verifyPayment) and Razorpay's server-to-server webhook (BACKEND_AUDIT.md
// §2.8). Both can legitimately arrive for the same payment, in either order,
// and Razorpay retries the webhook on any non-2xx response — so running twice
// is routine, not an edge case.
//
// Idempotency is enforced by an atomic conditional update rather than a
// read-then-write. Only the caller whose findOneAndUpdate actually flips the
// status from not-paid to paid goes on to enroll; a concurrent second caller
// matches no document, gets null back, and returns the already-fulfilled order
// without repeating the work. Checking `order.status !== "paid"` in JavaScript
// first would leave exactly the race this avoids: both callers read "created"
// before either writes, and both enroll. This is the same pattern §10.3
// documents for progress writes.
const fulfilOrder = async ({ razorpayOrderId, paymentId, signature, source }) => {
    const claimed = await Order.findOneAndUpdate(
        { razorpayOrder_id: razorpayOrderId, status: { $ne: "paid" } },
        {
            $set: {
                status: "paid",
                razorpayPayment_id: paymentId,
                paidAt: new Date(),
                // Which path actually won the race. Worth recording: if this
                // reads "webhook" in production, that order is one the browser
                // never came back to confirm — exactly the silent loss §2.8
                // describes, and the reason the webhook exists.
                fulfilmentSource: source,
                ...(signature ? { razorpaySignature: signature } : {}),
            },
        },
        { new: true }
    );

    if (!claimed) {
        // Either already fulfilled by the other caller, or no such order.
        const existing = await Order.findOne({ razorpayOrder_id: razorpayOrderId });
        return { order: existing, alreadyFulfilled: Boolean(existing), enrollmentResults: [] };
    }

    // enrollStudentInCourses is itself idempotent (it skips courses the student
    // already holds), which is a second layer of safety rather than the primary
    // one — the atomic claim above is what guarantees this runs once.
    const enrollmentResults = await enrollStudentInCourses(claimed.user_id, claimed.course_ids);

    await Cart.findOneAndUpdate(
        { user: claimed.user_id },
        { $pull: { items: { course: { $in: claimed.course_ids } } } }
    );

    // Written only after enrollment succeeds, so `status: "paid"` with a null
    // fulfilledAt is a readable signal that fulfilment died partway and the
    // order needs reconciling.
    await Order.updateOne({ _id: claimed._id }, { $set: { fulfilledAt: new Date() } });

    return { order: claimed, alreadyFulfilled: false, enrollmentResults };
};

export { fulfilOrder };
