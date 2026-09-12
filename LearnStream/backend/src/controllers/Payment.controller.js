// controllers/paymentController.js

import Razorpay from 'razorpay';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Order } from '../models/Orders.js';
import { Courses } from '../models/Course/courses.js';
import { Cart } from '../models/cart.model.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { enrollStudentInCourses } from '../utils/enrollment.js';
import crypto from 'crypto';

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
  const amount = courses.reduce((sum, course) => sum + course.price, 0) * 100; // paise

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

  if (expectedSignature !== razorpay_signature) {
    throw new ApiError(400, 'Invalid signature');
  }

  const order = await Order.findOneAndUpdate(
    { razorpayOrder_id: razorpay_order_id },
    {
      status: 'paid',
      razorpayPayment_id: razorpay_payment_id,
      razorpaySignature: razorpay_signature,
    },
    { new: true }
  );

  if (!order) {
    throw new ApiError(404, 'Order not found');
  }

  // Enroll the student and clear the purchased items from their cart in the
  // same request — a verified payment must never be left "paid but not
  // enrolled" waiting on a second, separately-failable client call.
  const enrollmentResults = await enrollStudentInCourses(
    order.user_id,
    order.course_ids
  );

  await Cart.findOneAndUpdate(
    { user: order.user_id },
    { $pull: { items: { course: { $in: order.course_ids } } } }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { order, enrollmentResults },
        'Payment verified and order updated'
      )
    );
});

export { createOrder, verifyPayment };
