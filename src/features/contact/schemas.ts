import { z } from 'zod';

/**
 * Contact and support payloads.
 *
 * EVERY FIELD IS BOUNDED. An unbounded textarea reaching an email body is both
 * an abuse vector and a way to blow past provider limits, so the caps are on
 * the schema rather than trusted from the client.
 */

/** Issue categories offered on the support form. */
export const SUPPORT_CATEGORIES = [
  'login_account',
  'trade_import',
  'billing_subscription',
  'technical',
  'data_issue',
  'security',
  'other',
] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_CATEGORY_LABEL: Record<SupportCategory, string> = {
  login_account: 'Login and account',
  trade_import: 'Trade import',
  billing_subscription: 'Billing and subscription',
  technical: 'Technical problem',
  data_issue: 'Data issue',
  security: 'Security concern',
  other: 'Other',
};

const name = z.string().trim().min(1, 'Please tell us your name.').max(80);
const email = z.string().trim().toLowerCase().email('Please check this email address.').max(160);
const subject = z.string().trim().min(3, 'Please add a short subject.').max(140);
const message = z
  .string()
  .trim()
  .min(20, 'Please add a little more detail — it saves a round trip.')
  .max(4_000);

/** Fields present on every form, carrying the bot-protection signals. */
const envelope = {
  /** Hidden. Must stay empty. Named innocuously so a bot fills it in. */
  company: z.string().max(100).default(''),
  /** Hidden. Epoch ms the form rendered. */
  renderedAt: z.coerce.number().int().nonnegative(),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'Please confirm before sending.' }),
  }),
};

export const contactRequestSchema = z.object({
  name,
  email,
  subject,
  message,
  ...envelope,
});
export type ContactRequestInput = z.infer<typeof contactRequestSchema>;

export const supportRequestSchema = z.object({
  name,
  email,
  subject,
  category: z.enum(SUPPORT_CATEGORIES),
  message,
  ...envelope,
});
export type SupportRequestInput = z.infer<typeof supportRequestSchema>;
