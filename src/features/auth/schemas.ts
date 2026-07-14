/**
 * Shared Zod schemas — ONE schema per flow, reused on client (RHF resolver) and
 * server (action re-validation). Never trust the client: server actions parse
 * with these same schemas.
 */
import { z } from 'zod';

/** Password policy. Tunable in one place; surfaced to the UI as hints. */
export const PASSWORD_POLICY = {
  minLength: 10,
  maxLength: 72, // bcrypt hard limit (Supabase hashes server-side)
} as const;

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email address')
  .max(254, 'Email is too long');

/**
 * Password strength policy. Breach-list check is a documented SEAM — enforce
 * `notBreached` server-side later (e.g. HaveIBeenPwned k-anonymity) without
 * changing this schema's shape.
 */
export const passwordSchema = z
  .string()
  .min(
    PASSWORD_POLICY.minLength,
    `Password must be at least ${PASSWORD_POLICY.minLength} characters`,
  )
  .max(PASSWORD_POLICY.maxLength, 'Password is too long')
  .regex(/[a-zA-Z]/, 'Password must include a letter')
  .regex(/[0-9]/, 'Password must include a number');
// TODO(security): add breach-list rejection here (server-side) when the
// FRS breach service is available.

export const signInSchema = z.object({
  email: emailSchema,
  // Login must not leak policy details, so only require non-empty here.
  password: z.string().min(1, 'Password is required'),
  // Optional (the form supplies the default) — kept as plain optional so the
  // schema's input and output types match and satisfy the RHF resolver.
  rememberMe: z.boolean().optional(),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    acceptTerms: z.literal(true, {
      errorMap: () => ({ message: 'You must accept the terms to continue' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const resendVerificationSchema = z.object({
  email: emailSchema,
});
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
