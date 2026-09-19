import crypto from "node:crypto";
import { env } from "../config/env.js";

const OTP_LENGTH = 6;
const OTP_MAX = 10 ** OTP_LENGTH;
const OTP_TTL_MS = 15 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_SENDS = 5;
const MAX_FAILED_ATTEMPTS = 5;

export { OTP_TTL_MS, RESEND_COOLDOWN_MS, MAX_SENDS, MAX_FAILED_ATTEMPTS };

/** crypto.randomInt is uniform over [0, OTP_MAX), zero-padded to 6 digits. */
export function generateOtp() {
  return String(crypto.randomInt(0, OTP_MAX)).padStart(OTP_LENGTH, "0");
}

/**
 * HMAC-SHA256 of the code, keyed by OTP_SECRET — stored instead of the raw
 * code (docs/contracts/api-conventions.md rate-limiting section) so reading
 * the pendingRegistration collection never discloses a valid code.
 */
export function hashOtp(code) {
  return crypto.createHmac("sha256", env.otpSecret).update(code).digest("hex");
}

/**
 * Constant-time comparison — a naive `===` on the hashes would leak, via
 * response timing, how many leading bytes of the hash matched, which is
 * exactly the kind of side channel timingSafeEqual exists to close.
 */
export function verifyOtp(code, storedHash) {
  const candidateHash = Buffer.from(hashOtp(code), "hex");
  const stored = Buffer.from(storedHash, "hex");
  if (candidateHash.length !== stored.length) return false;
  return crypto.timingSafeEqual(candidateHash, stored);
}
