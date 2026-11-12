# Libreng Invoice

A free invoice, quotation and receipt maker for sari-sari stores, small businesses and freelancers in the
Philippines. No subscription, and no paywall on downloads. Users sign in with Google or email and password, and
their documents are saved privately to their account (Supabase).

## Features

- **Documents:** Invoice, Quotation, Acknowledgement Receipt, Delivery Receipt, numbered automatically per type
  and year (`INV-2026-0001`)
- **Items:** units (pcs, kg, hr…), prices per kg/g or L/mL with conversion, or an amount typed by hand
- **Totals:** discount (percent or fixed), an extra fee (delivery, rush), down payment and balance due
- **Business profile:** logo, address, optional TIN, payment options (GCash, Maya, banks)
- **PDF** downloaded directly ("Save & get PDF"), or printed from the print button; a PAID stamp on fully paid invoices
- **Email** a document from the seller's own Gmail, email app or phone share sheet, with a message template they can
  edit in My business (`{customer}`, `{total}`, `{due}`…). The document is turned into a real PDF in the browser
  (jsPDF + html2canvas-pro, loaded only when needed): on phones it is attached automatically through Share, on
  computers it downloads so it can be attached. Optionally the app sends the email itself, with the PDF attached and
  the seller CC'd (see "Sending email from the app")
- **My documents:** search, filter by type and payment, amount still to collect, mark as paid, copy, delete
- **Backup and restore** as JSON; **delete account** erases everything
- Light, dark or device theme; works on phones (bottom navigation, sticky save bar)

Documents print "This document is not an official receipt." by default. They are not BIR-registered invoices or
official receipts.

## Setup

Requires Node 24+ and a Supabase project.

1. **Database.** In Supabase → SQL Editor, run each file in `supabase/migrations/` in order (`0001` to `0004`).
   Run new migrations **before** deploying the code that needs them.
   Every script is safe to re-run.
2. **Error log cleanup.** Enable `pg_cron` (Database → Extensions), then run once:
   `select cron.schedule('purge-error-logs', '17 3 * * *', 'select public.purge_old_error_logs()');`
3. **Auth settings** (Authentication):
   - Sign In / Providers → Email: minimum password length 8.
   - Sign In / Providers → Google: enable it, and add the Client ID and secret from Google Cloud. The OAuth
     client's redirect URI is `https://<project-id>.supabase.co/auth/v1/callback`.
   - URL Configuration: Site URL is the app's address; add `<app address>/**` to Redirect URLs.
   - Rate Limits: keep the defaults or lower them. Before launch, add custom SMTP (e.g. Resend), because the
     built-in sender only allows a few emails per hour.
   - Emails → templates: make links work on any device (see below).
4. **Environment.** Copy `.env.example` to `.env.local` and fill in the project URL and the **publishable** key.
   Never put the secret / `service_role` key or the database password in this file. The app refuses to start with one.

### Email templates (links that work on any device)

The default links only work in the browser that asked for them. In Authentication → Emails, change the link in:

- **Confirm signup:** `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`
- **Reset password:** `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`

The app verifies these links itself (`src/auth/session.ts`).

## Development

```bash
npm install
npm run dev        # http://localhost:5173 (or: npx vite --port 5199)
npm test           # unit tests (Vitest)
npm run typecheck
npm run lint
npm run build      # production build in dist/
```

## Project layout

```
src/
  auth/       sign-in, sign-up, password reset, session handling
  business/   business profile, logo validation, settings screen
  invoices/   document model, totals, units, numbering, editor/preview/history screens
  storage/    Supabase queries and validation of data read from the database or backups
  errors/     AppError, customer messages with reference codes, developer error logs, crash screen
  money/      centavo-based money parsing and formatting
  theme/      light/dark preference
  navigation/ the signed-out pages (sign-in, About at `#/about`)
  about/      the About page, shown in the app and to signed-out visitors
  ui/         shared form field, modal, confirm dialog, icons
supabase/migrations/   database schema, security rules, rate limits
```

## Design

The look is a receipt pad: warm paper, dark ink, the red of a printed receipt number and a yellow highlighter.
All colours, type sizes and spacing are tokens at the top of `src/styles.css`; light and dark themes share them.

- **Fonts** are self-hosted from npm (`@fontsource-variable`): Bricolage Grotesque for headings and Hanken Grotesk
  for text. The peso sign is always taken from Bricolage (the `Peso Sign` face), because Hanken's reads as a plain
  "P" at small sizes. A new text font must be checked for a clear ₱ before it is used.
- **Responsive:** checked at 320, 375, 768 and 1280px. Phones get a bottom navigation and a two-row total bar;
  tablets drop the navigation icons; the sign-in pitch shortens on phones so the form is in view.

## Security and integrity

- **Authorization is in the database.** The browser uses the public key, so Row Level Security limits every
  table to the signed-in user's rows. Signed-out visitors have no access.
- **Integrity:** document numbers are unique per user and type (a unique constraint); counters advance in the same
  transaction as the save; field sizes are checked in the database too.
- **Rate limits** (database triggers): 60 document saves and 20 profile saves per minute per user, 20 error logs
  per minute, and at most 10,000 documents per account. They show up as "going a bit too fast" in the app.
- **Money** is stored as integer centavos and quantities as thousandths, so totals never drift.
- **Backups and saved rows are untrusted input:** every field is type- and length-checked, and logos must be PNG,
  JPEG or WebP (checked by the file's bytes).
- **Headers:** `vercel.json` sets a strict Content-Security-Policy, HSTS and related headers.

## Errors: customer vs developer

- **Customers** see a plain message. Unexpected failures add a short reference code, e.g. "(Reference: K7Q2MX)".
- **Developers** find the full error in the browser console, and in the `client_error_logs` table (Supabase →
  Table Editor), searchable by that reference. Users can write log rows but never read them. Logs hold the error
  text, the page path and the browser, never document contents, tokens or passwords, and are deleted after 90 days.
- A crash screen replaces a blank page if a screen fails to render. Technical details appear only in development.

## Sending email from the app (optional)

Off by default. When on, the email window gets a "Send email with PDF" button. The email is sent through Brevo by
the Edge Function `supabase/functions/send-document-email`, from the service's address under the seller's business
name. The seller is always CC'd and set as Reply-To (their account's email; the browser cannot choose these).

Abuse controls: a confirmed account is required; `register_email_send()` (migration `0004`) allows 20 emails per
account and 250 in total per 24 hours; one recipient; plain text; PDF only, about 1.5 MB at most; a fixed footer
names the seller. Only the time of each send is stored.

Setup:

1. Run `0004_email_sending.sql`. Optionally schedule the cleanup:
   `select cron.schedule('purge-email-sends', '23 3 * * *', 'select public.purge_old_email_sends()');`
2. In Brevo, verify the sender. A domain you own (with DKIM) is strongly recommended; a free mailbox address as
   sender is rewritten by Brevo and lands in spam more often. Create an API key (SMTP & API → API Keys).
3. In Supabase → Edge Functions, create a function named `send-document-email` with the contents of
   `supabase/functions/send-document-email/index.ts` (or `supabase functions deploy send-document-email`).
4. In Edge Functions → Secrets, set `BREVO_API_KEY`, `EMAIL_SENDER_ADDRESS` and `ALLOWED_ORIGINS` (comma-separated,
   e.g. `https://your-app.vercel.app,http://localhost:5199`). The API key is a secret: never put it in `.env.local`,
   a `VITE_` variable or the repo.
5. Set `VITE_ENABLE_EMAIL_SENDING=true` in `.env.local` and in the host's environment variables, then rebuild.

API: `POST /functions/v1/send-document-email` · auth: the user's session · body `{ to, subject, message, fileName,
pdfBase64 }` · replies use the `{ status, data, message, error, requestId }` envelope with 200, 400, 401, 403, 429,
502 or 503.

## Deploying (Vercel)

`npm run build` outputs a static site in `dist/`. On Vercel, set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` as environment variables, then add the deployed address to Supabase URL
Configuration and to the Google OAuth client's authorized JavaScript origins.
