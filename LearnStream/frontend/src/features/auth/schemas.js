import { z } from 'zod';

// Mirrors backend/src/validation/auth.schemas.js's registerSchema password
// rule (>=8 chars, at least one letter and one digit) — duplicated here
// deliberately: the strength checklist needs to evaluate each rule
// independently as the user types, not just get a single pass/fail back
// from a resolver.
export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { id: 'letter', label: 'At least one letter', test: (v) => /[A-Za-z]/.test(v) },
  { id: 'digit', label: 'At least one digit', test: (v) => /[0-9]/.test(v) },
];

export const signupStep1Schema = z
  .object({
    firstName: z.string().trim().min(1, 'First name is required'),
    lastName: z.string().trim().min(1, 'Last name is required'),
    email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Za-z]/, 'Password must contain at least one letter')
      .regex(/[0-9]/, 'Password must contain at least one digit'),
    confirmPassword: z.string(),
    terms: z.boolean().refine((v) => v === true, { message: 'You must agree to the terms and conditions' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const otpSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
});
