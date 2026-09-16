import mongoose, { Schema } from "mongoose";
import { ROLES } from "./user.model.js";

// Holds a signup in progress until its OTP is verified (S-FR-1.2, S-FR-2.1).
// No User document — and therefore no session — exists until verification
// succeeds, so an abandoned or never-verified signup never leaves a "ghost"
// account behind, only this record, which expires on its own.
//
// One record per email (upserted on repeat signup attempts against the same
// address), not per attempt: a second POST /user/:role/signup for the same
// pending email resets the OTP/expiry/send-count rather than creating a
// second competing record.
const pendingRegistrationSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Already bcrypt-hashed before this document is saved (registration.service.js),
    // the same as User.password — never the plaintext password.
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    role: { type: String, required: true, enum: Object.values(ROLES) },
    // HMAC-SHA256(otp, OTP_SECRET) — never the raw 6-digit code, so a
    // database read alone can't produce a valid code (docs/contracts/
    // api-conventions.md rate-limiting section; otp.service.js does the
    // hashing/comparison).
    otpHash: { type: String, required: true },
    otpExpiresAt: { type: Date, required: true },
    failedAttempts: { type: Number, default: 0 },
    sendCount: { type: Number, default: 1 },
    resendAvailableAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// TTL index: Mongo reaps the document itself once otpExpiresAt passes, so an
// abandoned signup doesn't linger forever. registration.service.js ALSO
// checks otpExpiresAt in application code (the plan's "expiry also checked
// in code") rather than relying on Mongo's TTL sweep timing, which runs on
// its own ~60s cadence and is not guaranteed to have fired the instant a
// verify request arrives.
pendingRegistrationSchema.index({ otpExpiresAt: 1 }, { expireAfterSeconds: 0 });

export const PendingRegistration = mongoose.model("PendingRegistration", pendingRegistrationSchema);
