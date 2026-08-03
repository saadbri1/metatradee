# Email setup (Resend)

The transport is code-complete and tested. **No email has ever been delivered**
— Resend is not configured, so every send currently returns a typed
`not_configured` failure and the forms show a mailto fallback.

This file is the external work still required. None of it can be done from the
repository.

## Status

| Piece                       | Status                  |
| --------------------------- | ----------------------- |
| Transport adapter           | Code complete           |
| Validation, sanitisation    | Code complete           |
| Bot protection              | Code complete           |
| Failure handling            | Code complete           |
| Unit tests                  | 25 passing              |
| **Resend account + domain** | **Not done — external** |
| **Real delivery**           | **Never verified**      |

## What has to happen outside this repo

1. **Create a Resend account** and add `metatradee.com` as a sending domain.

2. **Add the DNS records Resend gives you.** Resend issues its own DKIM record
   and a `MAIL FROM` subdomain (typically `send.metatradee.com`) with an SPF
   TXT and an MX.

   **ADD, DO NOT REPLACE.** The domain already runs Spacemail for receiving,
   and its MX, SPF, DKIM, SRV and DMARC records must stay exactly as they are.
   Two specific traps:

   - **SPF must not be duplicated.** A domain may have only ONE `v=spf1` TXT
     record. If Spacemail already publishes one, Resend's `include:` is added
     to that existing record — a second `v=spf1` record makes SPF fail for
     everything, including mail you currently receive.
   - **Resend's MX belongs on the `MAIL FROM` subdomain**, not on the apex.
     Adding it at the apex would compete with Spacemail's MX and break
     inbound mail.

3. **Wait for verification.** Resend shows the domain as Verified once DNS
   propagates. Sending before that is rejected.

4. **Set the two variables** in Vercel (Preview first):

   ```
   RESEND_API_KEY=re_...
   SUPPORT_FROM_EMAIL="MetaTradee Support <support@metatradee.com>"
   ```

   Mark both **Sensitive**. `RESEND_API_KEY` is a send-on-your-behalf
   credential.

5. **Redeploy**, then submit the form on `/contact` once and confirm the mail
   arrives at `contact@metatradee.com`, and once on `/support` for
   `support@metatradee.com`.

## What to check on that first real send

The unit tests cover the code paths; only a live send can confirm these:

- the message arrives and is **not** in spam (an unverified or misconfigured
  SPF/DKIM usually lands in spam rather than bouncing, which looks like success
  from the application's side)
- **Reply-To is the sender's address**, so replying reaches them and not the
  support mailbox
- the acknowledgement reaches the submitter
- `SUPPORT_FROM_EMAIL` matches the verified domain exactly — a mismatched
  from-address is rejected with a 4xx, which the app surfaces as `rejected`

## Design notes worth knowing

- **From is always our own verified sender**; the submitted address is only ever
  `Reply-To`. A spoofed submission cannot make mail appear to come from someone
  else's domain.
- **Bodies are plain text.** No HTML is built from user input, so there is no
  template escaping to get wrong.
- **CR/LF is stripped** from every single-line field before it reaches the
  provider, so a crafted subject cannot inject a `Bcc` header.
- **Rate limiting is per-instance and in-memory.** It throttles a burst from one
  origin; it is not a global cap. The honeypot and timing checks do the heavier
  lifting. A shared store, or Turnstile, is the upgrade path — `bot-protection.ts`
  takes a plain signals object specifically so another signal can be added
  without touching the form or the transport.
- **No IP address is ever emailed or persisted** — it is used only as an
  in-memory counter key.
