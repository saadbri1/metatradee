/**
 * Shared Zod schemas for profile, preferences, trading profile, and onboarding.
 * One schema per flow, reused on client (RHF) and server (action re-validation).
 */
import { z } from 'zod';
import {
  ACCOUNT_SIZE_BANDS,
  CURRENCIES,
  DATE_FORMATS,
  DENSITIES,
  EXPERIENCE_LEVELS,
  MARKETS,
  RISK_PROFILES,
  RISK_UNITS,
  THEMES,
  TIME_FORMATS,
  TRADING_GOALS,
  TRADING_SESSIONS,
  TRADING_STYLES,
} from './config';
import {
  USERNAME_MAX,
  USERNAME_MIN,
  USERNAME_REGEX,
  isReservedUsername,
  normalizeUsername,
} from './lib/username';

// --- username --------------------------------------------------------------
/** Shape-only username validation (length + charset), no reserved check. Used
 *  by the availability endpoint so it can report `reserved` distinctly. */
export const usernameShapeSchema = z
  .string()
  .trim()
  .min(USERNAME_MIN, `At least ${USERNAME_MIN} characters`)
  .max(USERNAME_MAX, `At most ${USERNAME_MAX} characters`)
  .transform(normalizeUsername)
  .refine((v) => USERNAME_REGEX.test(v), {
    message: 'Use letters, numbers, and underscores; start with a letter.',
  });

/** Full username validation, including the reserved-name block. */
export const usernameSchema = usernameShapeSchema.refine((v) => !isReservedUsername(v), {
  message: 'That username is reserved.',
});

// --- profile ---------------------------------------------------------------
export const profileSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(1, 'Display name is required')
    .max(60, 'Display name is too long'),
  username: usernameSchema,
  bio: z.string().trim().max(500, 'Bio is too long').optional().or(z.literal('')),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/, 'Invalid country')
    .optional()
    .or(z.literal('')),
  timezone: z.string().min(1).max(64).optional().or(z.literal('')),
  preferred_language: z.string().min(2).max(10).optional().or(z.literal('')),
});
export type ProfileInput = z.infer<typeof profileSchema>;

// Availability check uses the shape-only schema so the action can report
// `reserved` vs `taken` vs `invalid` separately.
export const usernameCheckSchema = z.object({ username: usernameShapeSchema });

// --- preferences -----------------------------------------------------------
export const preferencesSchema = z.object({
  theme: z.enum(THEMES).optional(),
  density: z.enum(DENSITIES).optional(),
  currency: z.enum(CURRENCIES).optional(),
  date_format: z.enum(DATE_FORMATS).optional(),
  time_format: z.enum(TIME_FORMATS).optional(),
  risk_unit: z.enum(RISK_UNITS).optional(),
  reduced_motion: z.boolean().optional(),
  font_scale: z.number().min(0.75).max(1.5).optional(),
  auto_save: z.boolean().optional(),
  notify_email: z.boolean().optional(),
  notify_push: z.boolean().optional(),
  notify_product: z.boolean().optional(),
});
export type PreferencesInput = z.infer<typeof preferencesSchema>;

// --- trading profile -------------------------------------------------------
export const tradingProfileSchema = z.object({
  experience: z.enum(EXPERIENCE_LEVELS).optional(),
  trading_style: z.enum(TRADING_STYLES).optional(),
  markets: z.array(z.enum(MARKETS)).max(MARKETS.length).default([]),
  primary_broker: z.string().trim().max(80).optional().or(z.literal('')),
  account_size_band: z.enum(ACCOUNT_SIZE_BANDS).optional(),
  base_currency: z.enum(CURRENCIES).default('USD'),
  goals: z.array(z.enum(TRADING_GOALS)).max(TRADING_GOALS.length).default([]),
  preferred_sessions: z.array(z.enum(TRADING_SESSIONS)).max(TRADING_SESSIONS.length).default([]),
  risk_profile: z.enum(RISK_PROFILES).optional(),
});
export type TradingProfileInput = z.infer<typeof tradingProfileSchema>;

// --- onboarding ------------------------------------------------------------
export const onboardingStepSchema = z.object({
  step: z.number().int().min(0).max(10),
});
export type OnboardingStepInput = z.infer<typeof onboardingStepSchema>;
