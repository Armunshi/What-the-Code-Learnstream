import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { PendingRegistration } from "../models/pendingRegistration.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { generateOtp, hashOtp, verifyOtp, OTP_TTL_MS, RESEND_COOLDOWN_MS, MAX_SENDS, MAX_FAILED_ATTEMPTS } from "./otp.service.js";
import { sendOtpMail } from "./mail.service.js";

const normalizeEmail = (email) => email.trim().toLowerCase();

function issueOtpFields() {
  const code = generateOtp();
  const now = Date.now();
  return {
    code,
    otpHash: hashOtp(code),
    otpExpiresAt: new Date(now + OTP_TTL_MS),
    resendAvailableAt: new Date(now + RESEND_COOLDOWN_MS),
  };
}

/**
 * POST /user/:role/signup's business logic. Never creates a User or a
 * session — only a pendingRegistration record, emailed a fresh OTP.
 */
export async function startRegistration({ name, firstName, lastName, email, password, role }) {
  const normalizedEmail = normalizeEmail(email);

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    throw new ApiError(409, "An account with this email already exists", [
      { field: "email", code: "EMAIL_EXISTS" },
    ]);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const { code, otpHash, otpExpiresAt, resendAvailableAt } = issueOtpFields();

  // Upsert, not insert: a second signup attempt for the same still-pending
  // email resets the flow (new OTP, fresh 15-minute expiry, sendCount back
  // to 1) instead of erroring or leaving two competing records.
  const pending = await PendingRegistration.findOneAndUpdate(
    { email: normalizedEmail },
    {
      email: normalizedEmail,
      passwordHash,
      name,
      firstName,
      lastName,
      role,
      otpHash,
      otpExpiresAt,
      resendAvailableAt,
      failedAttempts: 0,
      sendCount: 1,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await sendOtpMail({ to: normalizedEmail, code });

  return { email: pending.email, expiresAt: pending.otpExpiresAt, resendAvailableAt: pending.resendAvailableAt };
}

/**
 * POST /auth/register/verify's business logic. Returns the freshly created
 * User on success; the caller (controller) is responsible for the session
 * (respondWithSession), which stays a controller concern.
 */
export async function verifyRegistration({ email, code }) {
  const normalizedEmail = normalizeEmail(email);
  const pending = await PendingRegistration.findOne({ email: normalizedEmail });

  if (!pending) {
    throw new ApiError(404, "No pending signup found for this email — it may have expired or already been verified");
  }

  if (pending.otpExpiresAt.getTime() <= Date.now()) {
    await PendingRegistration.deleteOne({ _id: pending._id });
    throw new ApiError(410, "This code has expired — request a new one");
  }

  if (!verifyOtp(code, pending.otpHash)) {
    pending.failedAttempts += 1;
    if (pending.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      await PendingRegistration.deleteOne({ _id: pending._id });
      throw new ApiError(410, "Too many incorrect attempts — request a new code");
    }
    await pending.save();
    throw new ApiError(400, "Incorrect code", [{ field: "code", code: "OTP_INCORRECT" }]);
  }

  // A concurrent signup for the same address could have created the User
  // between this record's creation and this verify call reaching here.
  const alreadyExists = await User.findOne({ email: normalizedEmail });
  if (alreadyExists) {
    await PendingRegistration.deleteOne({ _id: pending._id });
    throw new ApiError(409, "An account with this email already exists", [
      { field: "email", code: "EMAIL_EXISTS" },
    ]);
  }

  // pending.passwordHash is ALREADY bcrypt-hashed (registration.service's
  // own startRegistration hashed it before ever writing the pending
  // record), but User's pre-save hook unconditionally re-hashes whatever
  // `password` holds on a new document. Create with a throwaway value so
  // that hook has something harmless to hash, then set the real hash
  // directly via updateOne, which — unlike .save() — never runs document
  // middleware, so it can't be double-hashed.
  const user = await User.create({
    name: pending.name,
    firstName: pending.firstName,
    lastName: pending.lastName,
    email: pending.email,
    password: crypto.randomUUID(),
    role: pending.role,
  });
  const emailVerifiedAt = new Date();
  await User.updateOne({ _id: user._id }, { $set: { password: pending.passwordHash, emailVerifiedAt } });
  user.password = pending.passwordHash;
  user.emailVerifiedAt = emailVerifiedAt;

  await PendingRegistration.deleteOne({ _id: pending._id });

  return user;
}

/**
 * POST /auth/register/resend's business logic: 30s cooldown, 5-send cap,
 * a new code resets the 15-minute expiry.
 */
export async function resendRegistration({ email }) {
  const normalizedEmail = normalizeEmail(email);
  const pending = await PendingRegistration.findOne({ email: normalizedEmail });

  if (!pending) {
    throw new ApiError(404, "No pending signup found for this email — it may have expired or already been verified");
  }

  if (pending.resendAvailableAt.getTime() > Date.now()) {
    throw new ApiError(429, "Please wait before requesting another code");
  }

  if (pending.sendCount >= MAX_SENDS) {
    throw new ApiError(429, "Maximum number of codes sent for this signup — start over");
  }

  const { code, otpHash, otpExpiresAt, resendAvailableAt } = issueOtpFields();
  pending.otpHash = otpHash;
  pending.otpExpiresAt = otpExpiresAt;
  pending.resendAvailableAt = resendAvailableAt;
  pending.sendCount += 1;
  pending.failedAttempts = 0;
  await pending.save();

  await sendOtpMail({ to: normalizedEmail, code });

  return { email: pending.email, expiresAt: pending.otpExpiresAt, resendAvailableAt: pending.resendAvailableAt };
}

export async function isEmailAvailable(email) {
  const normalizedEmail = normalizeEmail(email);
  const existingUser = await User.findOne({ email: normalizedEmail }).select("_id");
  return !existingUser;
}
