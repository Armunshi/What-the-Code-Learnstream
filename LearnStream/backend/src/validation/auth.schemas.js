import { z } from "zod";

// §4.5 flagged no password length/strength constraint anywhere in this
// codebase — enforced here, at the request boundary, rather than the schema
// layer, so it produces a clean 400 instead of a Mongoose ValidationError.
export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  password: z.string().min(1, "Password is required"),
});
