import { Order } from "../../models/order.model.js";
import { Courses } from "../../models/course.model.js";

// One row per course, not per order: an order's course_ids can hold more
// than one course (a multi-course checkout), and the purchase-history page
// wants one line per course, matching how it's actually consumed.
export const listPurchases = async (userId) => {
    const orders = await Order.find({ user_id: userId, status: "paid" })
        .sort({ paidAt: -1 })
        .lean();

    const courseIds = [...new Set(orders.flatMap((order) => order.course_ids.map(String)))];
    const courses = await Courses.find({ _id: { $in: courseIds } })
        .select("title thumbnail price currency")
        .lean();
    const courseById = new Map(courses.map((course) => [String(course._id), course]));

    const items = [];
    for (const order of orders) {
        for (const courseId of order.course_ids) {
            const course = courseById.get(String(courseId));
            if (!course) continue; // the course was deleted since this order was placed
            items.push({
                orderId: String(order._id),
                courseId: String(course._id),
                title: course.title,
                thumbnailUrl: course.thumbnail ?? null,
                priceInPaise: course.price ?? 0,
                currency: order.currency ?? "INR",
                purchasedAt: order.paidAt ?? order.createdAt,
            });
        }
    }
    return items;
};
