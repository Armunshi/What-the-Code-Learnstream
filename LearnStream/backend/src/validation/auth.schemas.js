import { z } from "zod";

// §4.5 flagged no password length/strength constraint anywhere in this
// codebase — enforced here, at the request boundary, rather than the schema
// layer, so it produces a clean 400 instead of a Mongoose ValidationError.
//
// Plan's OTP-signup rule: >=8 characters, at least one letter and one digit.
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Za-z]/, "Password must contain at least one letter")
  .regex(/[0-9]/, "Password must contain at least one digit");

// `name` stays the field every existing caller sends (e2e's api-client.ts
// Credentials type is `{name, email, password}`, frozen — see the AUTH
// lane's task brief). firstName/lastName are additive: the new two-step
// SignupPage collects them separately and derives `name` from them client
// side before posting, so this schema accepts both shapes without a
// breaking change to the wire contract.
export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export const registerVerifySchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  code: z.string().trim().regex(/^\d{6}$/, "Code must be 6 digits"),
});

export const registerResendSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
});

export const emailAvailableQuerySchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
});

export const onboardingSchema = z
  .object({
    // Not SMS-verified (plan's onboarding note), so this is stored as-is
    // with no format beyond "non-empty" — the UI itself defaults to +91 and
    // never claims recovery/2FA use of this number.
    phone: z.string().trim().min(1).optional(),
    interests: z.array(z.string().trim().min(1)).optional(),
    dismissed: z.boolean().optional(),
  })
  .refine((data) => data.phone !== undefined || data.interests !== undefined || data.dismissed !== undefined, {
    message: "At least one of phone, interests or dismissed is required",
  });
