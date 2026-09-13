import { Router } from "express";
import { requireRole, verifyAuth } from "../middleware/auth.js";
import { ROLES } from "../models/user.model.js";
import { createOrder, verifyPayment, razorpayWebhook } from "../controllers/Payment.controller.js";

const router = Router();

router.post('/create-order',verifyAuth, requireRole(ROLES.STUDENT),createOrder);
router.post('/verify',verifyAuth, requireRole(ROLES.STUDENT),verifyPayment);

// Deliberately unauthenticated: Razorpay calls this server-to-server and has
// no student session or access token to present. Its authenticity comes from
// the HMAC signature over the raw request body, checked inside the handler
// against RAZORPAY_WEBHOOK_SECRET (BACKEND_AUDIT.md §2.8). Do not add an auth
// middleware here — that would silently break fulfilment for every real
// payment, which is the failure this endpoint exists to prevent.
router.post('/webhook', razorpayWebhook);

export default router
