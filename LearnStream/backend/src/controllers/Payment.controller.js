// controllers/paymentController.js

import Razorpay from 'razorpay';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Order } from '../models/Orders.js';
import { Courses } from '../models/Course/courses.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { fulfilOrder } from '../utils/fulfilment.js';
import crypto from 'crypto';

// Signature comparison in constant time. A plain !== leaks, through response
// timing, how long a prefix of a guessed signature was correct.
const signaturesMatch = (a, b) => {
  const bufA = Buffer.from(String(a), 'utf8');
  const bufB = Buffer.from(String(b), 'utf8');
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
};

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createOrder = asyncHandler(async (req, res) => {
  const user_id = req.student._id;

  const { course_ids, currency = 'INR' } = req.body;

  if (!Array.isArray(course_ids) || course_ids.length === 0) {
    throw new ApiError(400, 'course_ids (array) is required');
  }

  // Amount is derived server-side from real course prices — never trust a
  // client-supplied amount, since that would let a tampered request pay
  // whatever it wants for a course.
  const courses = await Courses.find({ _id: { $in: course_ids } }).select(
    'price'
  );
  if (courses.length !== course_ids.length) {
    throw new ApiError(404, 'One or more courses could not be found');
  }
  // Course prices are already integer paise (BACKEND_AUDIT.md §2.7), so this
  // is a plain sum with no rupee conversion. Math.round is belt-and-braces
  // against any legacy fractional price predating the migration — Razorpay
  // rejects a non-integer amount outright.
  const amount = Math.round(
    courses.reduce((sum, course) => sum + course.price, 0)
  );

  const receipt = `rcpt-${Date.now()}`;

  const options = {
    amount,
    currency,
    receipt,
    notes: {
      course_ids: course_ids.join(','),
      user_id,
    },
  };

  let order;
  try {
    order = await instance.orders.create(options);
    console.log('Razorpay order created ⇒', order);
  } catch (err) {
    console.error('Razorpay error ⇒', err);
    throw new ApiError(
      400,
      err.error?.description || 'Razorpay rejected request'
    );
  }

  await Order.create({
    course_ids, // store array of courses
    user_id,
    razorpayOrder_id: order.id,
    amount,
    currency,
    status: 'created',
  });

  return res
    .status(200)
    .json(new ApiResponse(200, order, 'Order created successfully'));
});

const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new ApiError(400, 'Missing required Razorpay parameters');
  }

  const sign = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(sign.toString())
    .digest('hex');

  if (!signaturesMatch(expectedSignature, razorpay_signature)) {
    throw new ApiError(400, 'Invalid signature');
  }

  const order = await Order.findOne({ razorpayOrder_id: razorpay_order_id });

  if (!order) {
    throw new ApiError(404, 'Order not found');
  }

  // The signature proves the payment is genuine, not that this caller owns it.
  // Without this check any authenticated student could drive the fulfilment of
  // another student's order (BACKEND_AUDIT.md §2.9).
  if (order.user_id.toString() !== req.student._id.toString()) {
    throw new ApiError(403, 'This order belongs to another account');
  }

  // Ask Razorpay what actually happened. The HMAC only proves the
  // order_id|payment_id pair was signed with our key secret — it says nothing
  // about whether money was captured, or how much. Until this call existed,
  // anyone holding the key secret could enroll for free by signing an invented
  // payment id, because nothing ever contacted Razorpay (§2.9).
  let payment;
  try {
    payment = await instance.payments.fetch(razorpay_payment_id);
  } catch (err) {
    console.error('Razorpay payment fetch failed ⇒', err);
    throw new ApiError(502, 'Could not confirm this payment with Razorpay');
  }

  if (payment.order_id !== razorpay_order_id) {
    throw new ApiError(400, 'Payment does not belong to this order');
  }
  if (payment.status !== 'captured') {
    throw new ApiError(
      402,
      `Payment is not captured (status: ${payment.status})`
    );
  }
  if (payment.amount !== order.amount) {
    throw new ApiError(400, 'Paid amount does not match the order amount');
  }

  // Fulfilment is shared with the webhook and safe to repeat: whichever of the
  // two arrives first enrolls, the other simply observes alreadyFulfilled.
  const { order: fulfilled, alreadyFulfilled, enrollmentResults } =
    await fulfilOrder({
      razorpayOrderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
      source: 'verify',
    });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { order: fulfilled, enrollmentResults, alreadyFulfilled },
        alreadyFulfilled
          ? 'Payment already verified'
          : 'Payment verified and order updated'
      )
    );
});

// Razorpay's server-to-server notification, and the authoritative fulfilment
// path (BACKEND_AUDIT.md §2.8). verifyPayment only runs if the student's
// browser comes back after checkout; when they close the tab or lose
// connectivity, this is what still enrolls them. Unauthenticated by design —
// see the route definition for why.
const razorpayWebhook = asyncHandler(async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    // Loud, not silent: a webhook that quietly no-ops is indistinguishable
    // from not having one, which is the exact gap this endpoint closes.
    console.error(
      '[webhook] RAZORPAY_WEBHOOK_SECRET is not set — cannot verify, refusing'
    );
    throw new ApiError(500, 'Webhook is not configured');
  }

  const signature = req.get('x-razorpay-signature');
  if (!signature || !req.rawBody) {
    throw new ApiError(400, 'Missing webhook signature or body');
  }

  const valid = Razorpay.validateWebhookSignature(
    req.rawBody.toString('utf8'),
    signature,
    secret
  );
  if (!valid) {
    throw new ApiError(400, 'Invalid webhook signature');
  }

  const event = req.body?.event;
  const paymentEntity = req.body?.payload?.payment?.entity;

  // Acknowledge everything else with a 200. Razorpay retries any non-2xx, so
  // erroring on an event we will never act on only guarantees it comes back.
  if (event !== 'payment.captured' || !paymentEntity) {
    return res
      .status(200)
      .json(
        new ApiResponse(200, { event, handled: false }, 'Event acknowledged')
      );
  }

  const order = await Order.findOne({
    razorpayOrder_id: paymentEntity.order_id,
  });
  if (!order) {
    console.error(
      `[webhook] payment.captured for unknown order ${paymentEntity.order_id}`
    );
    return res
      .status(200)
      .json(new ApiResponse(200, { handled: false }, 'No matching order'));
  }

  // The payload is signed, so its amount is trustworthy — but it still has to
  // match what we actually asked for before anyone gets enrolled.
  if (paymentEntity.amount !== order.amount) {
    console.error(
      `[webhook] amount mismatch for order ${order.razorpayOrder_id}: ` +
        `paid ${paymentEntity.amount}, expected ${order.amount}`
    );
    return res
      .status(200)
      .json(new ApiResponse(200, { handled: false }, 'Amount mismatch'));
  }

  const { alreadyFulfilled, enrollmentResults } = await fulfilOrder({
    razorpayOrderId: paymentEntity.order_id,
    paymentId: paymentEntity.id,
    source: 'webhook',
  });

  if (!alreadyFulfilled) {
    console.log(
      `[webhook] fulfilled order ${order.razorpayOrder_id} — the browser never confirmed it`
    );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { handled: true, alreadyFulfilled, enrollmentResults },
        'Webhook processed'
      )
    );
});

export { createOrder, verifyPayment, razorpayWebhook };
