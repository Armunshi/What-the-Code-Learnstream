// models/payment/orderModel.js
import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
  course_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: "Courses", required: true }],
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "UserStudent", required: true },
  // Unique because it is the idempotency key for fulfilment: both the browser
  // callback and the Razorpay webhook look an order up by this id and race to
  // claim it (BACKEND_AUDIT.md §2.8/§2.9). Two orders sharing one Razorpay id
  // would let the same payment enroll twice.
  razorpayOrder_id: { type: String, required: true, unique: true, index: true },
  razorpayPayment_id: { type: String },
  razorpaySignature: { type: String },
  // Integer paise, matching courses.price (§2.7).
  amount: { type: Number, required: true },
  currency: { type: String, default: "INR" },
  status: { type: String, enum: ["created", "paid", "failed"], default: "created" },
  paidAt: { type: Date },
  // Set only after enrollment succeeds, so `status: "paid"` with no
  // fulfilledAt marks an order whose fulfilment died partway and needs
  // reconciling — see scripts/reconcile-orders.js.
  fulfilledAt: { type: Date },
  fulfilmentSource: { type: String, enum: ["verify", "webhook"] },
}, { timestamps: true });


export const Order = mongoose.model("Order", orderSchema);
