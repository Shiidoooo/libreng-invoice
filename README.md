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
- **PDF** through the browser's print dialog, with a PAID stamp on fully paid invoices
- **Email** a document from the seller's own Gmail, email app or phone share sheet, with a message template they can
  edit in My business (`{customer}`, `{total}`, `{due}`…). The document is turned into a real PDF in the browser
  (jsPDF + html2canvas-pro, loaded only when needed): on phones it is attached automatically through Share, on
  computers it downloads so it can be attached. The app never sends email itself, so messages come from the seller's
  real address and the app cannot be used to send spam
- **My documents:** search, filter by type and payment, amount still to collect, mark as paid, copy, delete
- **Backup and restore** as JSON; **delete account** erases everything
- Light, dark or device theme; works on phones (bottom navigation, sticky save bar)

Documents print "This document is not an official receipt." by default. They are not BIR-registered invoices or
official receipts.

## Setup

Requires Node 24+ and a Supabase project.

1. **Database.** In Supabase → SQL Editor, run each file in `supabase/migrations/` in order (`0001`, `0002`, then `0003`).
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
  ui/         shared form field, modal, confirm dialog, icons
supabase/migrations/   database schema, security rules, rate limits
```

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

## Deploying (Vercel)

`npm run build` outputs a static site in `dist/`. On Vercel, set `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` as environment variables, then add the deployed address to Supabase URL
Configuration and to the Google OAuth client's authorized JavaScript origins.
