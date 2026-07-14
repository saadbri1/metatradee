import { z } from 'zod';

/**
 * Validated environment access. Import `env` instead of reading process.env
 * directly. Server-only secrets are never referenced from client components.
 * Validation runs once at module load and fails fast on misconfiguration.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_APP_ENV: z
    .enum(['development', 'preview', 'staging', 'production'])
    .default('development'),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  // Observability (placeholder — no monitoring wired yet). Optional.
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional().or(z.literal('')),
  // Billing (Phase 9.14). Only the PUBLISHABLE key ever reaches the client;
  // secret + webhook keys are server-side only (serverSchema below). Optional
  // so builds/tests run without a live provider (falls back to mock).
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional().or(z.literal('')),
});

const clientEnv = clientSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
});

if (!clientEnv.success) {
  // Surface a clear, actionable message rather than a cryptic runtime crash.
  console.error('Invalid public environment variables:', clientEnv.error.flatten().fieldErrors);
  throw new Error('Invalid public environment variables. See .env.example.');
}

export const env = clientEnv.data;

/**
 * Server-only environment. Call `serverEnv()` from server code only.
 * Kept lazy so it is never bundled into client output.
 */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  // Observability (placeholder — no monitoring wired yet). Optional.
  SENTRY_DSN: z.string().url().optional().or(z.literal('')),
  // AI Coach (Phase 9.12). All optional — absent keys fall back to the
  // deterministic mock provider so builds/tests never require live models.
  // Provider is chosen by config, NOT hardcoded (vendor-independence).
  AI_PROVIDER: z.enum(['anthropic', 'openai', 'gemini', 'openrouter', 'mock']).optional(),
  AI_MODEL_CHEAP: z.string().min(1).optional(),
  AI_MODEL_FRONTIER: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional().or(z.literal('')),
  OPENAI_API_KEY: z.string().min(1).optional().or(z.literal('')),
  GOOGLE_AI_API_KEY: z.string().min(1).optional().or(z.literal('')),
  OPENROUTER_API_KEY: z.string().min(1).optional().or(z.literal('')),
  // Billing (Phase 9.14) — SECRET keys, server-side only, never client-exposed.
  // Absent → mock provider (no live charges). Card data is NEVER handled here.
  BILLING_PROVIDER: z.enum(['stripe', 'paddle', 'mock']).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional().or(z.literal('')),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional().or(z.literal('')),
  PADDLE_API_KEY: z.string().min(1).optional().or(z.literal('')),
  PADDLE_WEBHOOK_SECRET: z.string().min(1).optional().or(z.literal('')),
});

export function serverEnv() {
  const parsed = serverSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SENTRY_DSN: process.env.SENTRY_DSN,
    AI_PROVIDER: process.env.AI_PROVIDER,
    AI_MODEL_CHEAP: process.env.AI_MODEL_CHEAP,
    AI_MODEL_FRONTIER: process.env.AI_MODEL_FRONTIER,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    BILLING_PROVIDER: process.env.BILLING_PROVIDER,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    PADDLE_API_KEY: process.env.PADDLE_API_KEY,
    PADDLE_WEBHOOK_SECRET: process.env.PADDLE_WEBHOOK_SECRET,
  });
  if (!parsed.success) {
    throw new Error('Invalid server environment variables. See .env.example.');
  }
  return parsed.data;
}
