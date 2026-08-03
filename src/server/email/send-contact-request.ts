/**
 * Composing and sending the contact/support emails — SERVER ONLY.
 *
 * SANITISATION HAPPENS HERE, once, for everything user-controlled. Two things
 * are being defended against:
 *
 *   HEADER INJECTION — a newline in a subject or reply-to can inject extra
 *   headers. Every single-line field is stripped of CR/LF before it goes near
 *   the provider, so a crafted "subject" cannot add a Bcc.
 *
 *   FALSE ATTRIBUTION — the submitted address is used as reply-to, never as
 *   the From. From is always our own verified sender, so a spoofed submission
 *   cannot make mail appear to originate from someone else's domain.
 *
 * Bodies are plain text. No HTML is generated from user input anywhere in this
 * path, so there is no template escaping to get wrong.
 */
import 'server-only';
import { COMPANY_EMAILS } from '@/config/contact';
import {
  INQUIRY_TYPE_LABEL,
  SUPPORT_CATEGORY_LABEL,
  type InquiryType,
  type SupportCategory,
} from '@/features/contact/schemas';
import { sendEmail } from './resend-client';
import type { EmailResult } from './email-result';

/** Collapse to a single safe line. Strips CR/LF and clamps length. */
function singleLine(value: string, max = 200): string {
  return value
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Multi-line body text: normalise newlines, drop control characters. */
function bodyText(value: string, max = 4_000): string {
  return (
    value
      .replace(/\r\n/g, '\n')
      // Control characters except tab and newline.
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .trim()
      .slice(0, max)
  );
}

export interface RequestContext {
  /** Page the form was submitted from. */
  pageUrl?: string;
  /** Truncated UA string. Never an IP — that is logged, not emailed. */
  userAgent?: string;
}

function contextBlock(ctx: RequestContext): string {
  const lines = [`Received: ${new Date().toISOString()}`];
  if (ctx.pageUrl) lines.push(`Page: ${singleLine(ctx.pageUrl, 300)}`);
  if (ctx.userAgent) lines.push(`Browser: ${singleLine(ctx.userAgent, 200)}`);
  return lines.join('\n');
}

export interface ContactPayload {
  name: string;
  email: string;
  inquiryType: InquiryType;
  subject: string;
  message: string;
}

/**
 * Inquiry type -> mailbox. THE ONLY place a contact recipient is decided.
 *
 * The client sends the enum key and nothing else; this map turns it into an
 * address. A form that accepted a recipient would let anyone who can post to
 * the action send mail from our verified domain to any address they chose.
 */
const RECIPIENT_BY_INQUIRY: Record<InquiryType, string> = {
  general: COMPANY_EMAILS.contact,
  information: COMPANY_EMAILS.info,
  sales: COMPANY_EMAILS.sales,
  support: COMPANY_EMAILS.support,
};

export function recipientFor(inquiryType: InquiryType): string {
  return RECIPIENT_BY_INQUIRY[inquiryType];
}

export async function sendContactRequest(
  payload: ContactPayload,
  ctx: RequestContext = {},
): Promise<EmailResult> {
  const name = singleLine(payload.name, 80);
  const from = singleLine(payload.email, 160);
  const label = INQUIRY_TYPE_LABEL[payload.inquiryType];
  return sendEmail({
    // Resolved from the enum, never from anything the client supplied.
    to: recipientFor(payload.inquiryType),
    subject: `[${label}] ${singleLine(payload.subject, 140)}`,
    replyTo: from,
    text: [
      `From: ${name} <${from}>`,
      `Inquiry: ${label}`,
      '',
      bodyText(payload.message),
      '',
      '---',
      contextBlock(ctx),
    ].join('\n'),
  });
}

/**
 * Support payloads do NOT carry an inquiry type. Every support request goes to
 * one mailbox, so there is no routing decision to make — and no field for a
 * client to influence it with.
 */
export interface SupportPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
  category: SupportCategory;
}

export async function sendSupportRequest(
  payload: SupportPayload,
  ctx: RequestContext = {},
): Promise<EmailResult> {
  const name = singleLine(payload.name, 80);
  const from = singleLine(payload.email, 160);
  const category = SUPPORT_CATEGORY_LABEL[payload.category];
  return sendEmail({
    to: COMPANY_EMAILS.support,
    subject: `[Support · ${category}] ${singleLine(payload.subject, 140)}`,
    replyTo: from,
    text: [
      `From: ${name} <${from}>`,
      `Category: ${category}`,
      '',
      bodyText(payload.message),
      '',
      '---',
      contextBlock(ctx),
    ].join('\n'),
  });
}

/**
 * Acknowledgement to the person who wrote in.
 *
 * Sent AFTER the internal message succeeds, and its own failure is not
 * surfaced: if we have the request but the receipt bounced, the user has still
 * been heard, and telling them "sending failed" would be wrong.
 */
export async function sendAcknowledgement(
  to: string,
  subject: string,
  replyMailbox: string,
): Promise<EmailResult> {
  return sendEmail({
    to: singleLine(to, 160),
    subject: `We received your message — ${singleLine(subject, 120)}`,
    text: [
      'Thanks for writing to MetaTradee.',
      '',
      'Your message has reached the team and a person will reply to this address.',
      `If you need to add anything, reply to this email or write to ${replyMailbox}.`,
      '',
      'Please never send passwords, broker credentials, API keys or full card',
      'numbers — MetaTradee support will never ask for them.',
      '',
      '— MetaTradee',
    ].join('\n'),
  });
}
