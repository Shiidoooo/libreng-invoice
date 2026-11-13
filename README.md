# Libreng Invoice

**Free invoices, quotations and receipts for small businesses in the Philippines.**

Libreng Invoice is a web app for sari-sari stores, online sellers, small shops and freelancers. You type what you
sold, and it makes a clean, numbered document with your business name, logo, prices and payment details (GCash,
Maya, bank). You can download it as a PDF, print it, or email it to your customer with the PDF attached.

There is no subscription, no watermark and no fee to download your PDF. Your documents are saved to your own
account, so they open on your phone and on your computer.

> **Important:** documents made here are **not BIR-registered invoices or official receipts**. They are for
> billing, quotations and record keeping. Each document prints "This document is not an official receipt." by
> default.

---

## Contents

- [What it does](#what-it-does)
- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Database](#database)
- [Security](#security)
- [Errors: what customers see vs. what developers see](#errors-what-customers-see-vs-what-developers-see)
- [Getting started (local development)](#getting-started-local-development)
- [Setting up Supabase](#setting-up-supabase)
- [Sending email from the app (Brevo)](#sending-email-from-the-app-brevo)
- [Deploying to Vercel](#deploying-to-vercel)
- [Environment variables and secrets](#environment-variables-and-secrets)
- [Testing and checks](#testing-and-checks)
- [Design](#design)
- [Limits](#limits)
- [Before going live with real customers](#before-going-live-with-real-customers)

---

## What it does

### Four kinds of documents

| Document | Number format | Use it when |
|---|---|---|
| **Invoice** | `INV-2026-0001` | The customer still has to pay. Has a due date, down payment and balance due. |
| **Quotation** | `QUO-2026-0001` | The customer asks for a price before ordering. Has a "valid until" date and a signature line. |
| **Acknowledgement Receipt** | `AR-2026-0001` | The customer paid and wants proof you received the money. |
| **Delivery Receipt** | `DR-2026-0001` | You deliver goods and the customer signs that they received them. |

Numbers are assigned automatically, counted separately for each type, and restart every year. You can type your
own number instead; the same number is never used twice.

### Main features

- **Items priced the way small shops sell:** per piece, per kilo, per hour… Sold 500 g but priced per kilo? The
  amount is converted for you (g↔kg, mL↔L). You can also type the line amount yourself (suki prices, round-offs).
- **Totals:** discount (percent or fixed amount), an extra fee (delivery, rush), down payment and balance due.
- **Live preview:** see exactly what the customer will get while you type.
- **PDF:** "Save & get PDF" downloads the file straight away; a print button is there for paper. Fully paid
  invoices get a red **PAID** stamp.
- **Email with the PDF attached:** sent for you under your business name, with a copy to you and replies coming
  to you. You can edit the message each time, or change the usual message (template) in **My business**.
- **Share on phones:** send the PDF through Gmail, Messenger or Viber from the phone's share sheet.
- **My documents:** search, filter by type and payment status, see how much is **still to collect**, edit, copy,
  email, delete, and **mark as paid** (with **Undo**, and **Mark as unpaid** later).
- **Business profile:** name, address, logo, phone, email, optional TIN, payment options.
- **Your customers, remembered:** start typing a past customer's name and their details fill in.
- **Backup and restore** of all your data as a file; **delete account** erases everything.
- **Safety nets:** confirmations before signing out, marking paid or unpaid, deleting, removing a filled-in item
  and restoring a backup. Unsaved work survives an accidental refresh.
- **Light and dark mode,** and a layout made for phones first.
- **About page** that explains the app to visitors before they sign up (`#/about`).
- **Privacy Policy** (`#/privacy`) and **Terms of Use** (`#/terms`), written for the Philippine Data Privacy Act
  of 2012 (RA 10173), linked from the sign-in screen and every footer.

---

## How it works

The app is a **static website** (HTML, CSS and JavaScript files) with **no server of its own**. Everything that
must be kept secret or enforced happens in **Supabase**.

```
                         ┌────────────────────────────────────────────────────────────┐
                         │                         Supabase                           │
 ┌──────────────────┐    │                                                            │
 │  Browser         │    │  Auth ─────────── sign-in (Google, email + password),      │
 │  (React app,     │───▶│                   sign-up, password reset                  │
 │  served by       │    │                                                            │
 │  Vercel)         │───▶│  Postgres ─────── your profile and documents               │
 │                  │    │   + Row Level      every row is locked to its owner,       │
 │  makes the PDF   │    │     Security       limits and checks run in the database   │
 │  on the device   │    │                                                            │
 │                  │───▶│  Edge Function ── send-document-email ──▶ Brevo ──▶ customer│
 └──────────────────┘    │  (holds the Brevo API key)                   (CC to you)   │
                         └────────────────────────────────────────────────────────────┘
```

- **Vercel** only serves the app's files. It never sees your data.
- **The browser** talks to Supabase directly with a **public** key. That key is safe to publish: the database's
  own rules (Row Level Security) decide what each signed-in user may read and write.
- **The PDF** is made on your device from the same layout as the preview, so it looks exactly like what you see.
- **Email** is the one feature that needs a secret (the Brevo API key), so it runs in a Supabase Edge Function
  on the server, never in the browser.

---

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| UI | **React 19** + **TypeScript 7** (strict) | Components and type checking catch mistakes before users do. |
| Build | **Vite 8** | Fast development server and small production build. |
| Styling | **Plain CSS** with design tokens (`src/styles.css`) | No UI library to learn or update; light and dark themes from one set of tokens. |
| Fonts | **Bricolage Grotesque** + **Hanken Grotesk** (`@fontsource-variable`, self-hosted) | No calls to outside font servers; both show a clear ₱ sign. |
| Auth | **Supabase Auth** (PKCE flow) | Google sign-in, email + password, email confirmation and password reset, with hashed passwords handled for us. |
| Database | **Supabase Postgres** with **Row Level Security** | Each user can only touch their own rows, enforced by the database itself. |
| Server code | **Supabase Edge Functions** (Deno) | Sends emails without exposing the Brevo key. |
| Email | **Brevo** transactional API | Sends invoice emails with the PDF attached; free plan of 300 emails a day. |
| PDF | **jsPDF** + **html2canvas-pro** | Turns the on-screen document into a real PDF file in the browser. Loaded only when needed. |
| Hosting | **Vercel** | Free static hosting, deploys automatically on every push to `main`. Security headers in `vercel.json`. |
| Tests | **Vitest** | Unit tests for money, totals, units, numbering, drafts, backups, email and config. |
| Lint | **oxlint** | Fast linting, including React hook rules. |

All dependencies are pinned to exact versions (`.npmrc` has `save-exact`), and `npm audit` reports no known
vulnerabilities.

---

## Project structure

```
src/
  main.tsx              entry point: error boundary, global error handlers
  App.tsx               picks the screen: setup problem, sign-in, About, reset password, or the app
  Workspace.tsx         the signed-in app: navigation, data loading, saving, confirmations
  styles.css            all styles and design tokens (light and dark)

  auth/                 sign-in, sign-up, forgot/reset password, session handling
  about/                the About page, and the shell for public pages (About, Privacy, Terms)
  legal/                Privacy Policy, Terms of Use, and legalInfo.ts (contact, providers, date)
  navigation/           public page routing (#/about, #/privacy, #/terms)
  business/             business profile ("My business"), logo checks
  invoices/             the core: document types, editor, preview, totals, units, numbering,
                        drafts, My documents, PDF, email
  storage/              Supabase client, all database calls, backup file format and checks
  money/                peso amounts as whole centavos: parsing and formatting
  dates/                calendar dates without time-zone surprises
  errors/               AppError, friendly messages with reference codes, crash screen
  config/               reads and validates the environment variables at startup
  theme/                light / dark / device theme
  ui/                   shared pieces: form field, modal, confirm dialog, icons

public/
  theme-init.js         applies the saved theme before the page paints (no flash)

supabase/
  migrations/           database schema, security rules and limits (run in order)
  functions/
    send-document-email/index.ts   the Edge Function that sends emails through Brevo

vercel.json             security headers for the hosted site
.env.example            the environment variables the app needs (placeholders only)
```

---

## Database

Run the migrations in `supabase/migrations/` **in order**. Each one is safe to run more than once.

| Migration | What it adds |
|---|---|
| `0001_initial_schema.sql` | Tables `business_profiles`, `documents`, `document_counters`; Row Level Security; automatic numbering; `delete_my_account()` |
| `0002_rate_limits_and_error_logs.sql` | Rate limits, the 10,000-documents cap, size checks, the `client_error_logs` table, `purge_old_error_logs()` |
| `0003_email_template.sql` | The editable email subject and message on the business profile |
| `0004_email_sending.sql` | The `email_sends` table and `register_email_send()` daily email limits, `purge_old_email_sends()` |

| Table | Holds | Who can access |
|---|---|---|
| `business_profiles` | One row per user: name, address, logo, payment options, email template | Only the owner |
| `documents` | Invoices, quotations and receipts. Items, customer and discount are stored as JSON. | Only the owner |
| `document_counters` | The last number used per type and year | The owner can read; only the database writes |
| `rate_limit_buckets` | Counters for the per-minute limits | Nobody directly (database only) |
| `client_error_logs` | Technical error notes, kept 90 days | Users can add; nobody can read from the app |
| `email_sends` | The time of each email sent (nothing else) | Nobody directly (database only) |

Money is stored as **whole centavos** and quantities as **thousandths**, so totals never drift (no floating-point
rounding errors).

---

## Security

- **Authorization lives in the database.** Every table has Row Level Security. A signed-in user only ever sees
  and changes their own rows; signed-out visitors get nothing.
- **No secrets in the app.** The browser only has the public Supabase URL and publishable key. The app refuses to
  start if a secret key is put there by mistake.
- **Email can't be abused for spam:** only confirmed accounts can send; 20 emails per account and 250 in total per
  day; one recipient; plain text; PDF only, up to about 1.5 MB; the CC and Reply-To are always the account's own
  email (set by the server, not the browser); a footer names the sender.
- **Integrity:** document numbers are unique per user and type; the counter moves in the same transaction as the
  save; marking paid only changes the amount paid, so it can't undo other edits.
- **Limits:** 60 document saves and 20 profile saves per minute, 20 error logs per minute, 10,000 documents per
  account, and size limits on every field, all enforced in the database.
- **Untrusted input is checked:** saved rows and backup files are validated field by field; logos must be PNG,
  JPEG or WebP, checked by the file's actual bytes, up to 300 KB.
- **Browser protections:** a strict Content-Security-Policy (no inline scripts, no outside scripts),
  `frame-ancestors 'none'`, HSTS, `nosniff`, a referrer policy and a permissions policy (`vercel.json`).
- **Sign-in:** PKCE flow; email links use `token_hash` so they work on any device; password reset never reveals
  whether an account exists.
- **Git:** `.env*` files (except `.env.example`), key files and `test-reports/` are ignored.

---

## Errors: what customers see vs. what developers see

- **Customers** see a plain, friendly message. Unexpected problems add a short reference, for example
  *"Could not save. (Reference: K7Q2MX)"*.
- **Developers** find the full error in the browser console and in the `client_error_logs` table (Supabase →
  Table Editor), searchable by that reference. Logs hold the error, the page and the browser type, never
  documents, tokens or passwords, and are deleted after 90 days.
- **Email problems** are logged in Supabase → Edge Functions → `send-document-email` → Logs (status codes only,
  no email addresses or keys).
- If a screen crashes, a crash screen replaces the blank page. Technical details only show in development.

---

## Getting started (local development)

**You need:** Node.js 24 or newer, and a Supabase project (free plan is fine).

```bash
npm install
cp .env.example .env.local        # then fill in the two Supabase values (see below)
npm run dev                       # opens on http://localhost:5173
```

To use the same address as the rest of this guide: `npx vite --port 5199`.

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm test` | Run the unit tests (Vitest) |
| `npm run typecheck` | Check types (TypeScript) |
| `npm run lint` | Lint the code (oxlint) |
| `npm run build` | Type-check and build the production site into `dist/` |
| `npm run preview` | Serve the production build locally |

---

## Setting up Supabase

1. **Run the migrations.** Supabase → **SQL Editor** → paste and run `0001`, `0002`, `0003`, `0004` in order.
2. **Clean-up jobs (optional but recommended).** Database → Extensions → enable **pg_cron**, then run:
   ```sql
   select cron.schedule('purge-error-logs', '17 3 * * *', 'select public.purge_old_error_logs()');
   select cron.schedule('purge-email-sends', '23 3 * * *', 'select public.purge_old_email_sends()');
   ```
3. **Sign-in providers** (Authentication → Sign In / Providers):
   - **Email:** minimum password length 8.
   - **Google:** enable it and add the Client ID and secret from Google Cloud. In Google Cloud, the OAuth
     client's redirect URI is `https://<project-id>.supabase.co/auth/v1/callback`.
4. **Addresses** (Authentication → URL Configuration):
   - **Site URL:** your live address, e.g. `https://your-app.vercel.app`.
   - **Redirect URLs:** `https://your-app.vercel.app/**` and `http://localhost:5199/**`.
5. **Email links that work on any device** (Authentication → Emails → Templates). Change the link in:
   - **Confirm signup:** `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email`
   - **Reset password:** `{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`
6. **Keys for the app:** Project Settings → API Keys → copy the **Project URL** and the **publishable** key into
   `.env.local`. Never use the secret / `service_role` key or the database password in the app.

---

## Sending email from the app (Brevo)

When this is set up, the email window shows **Send email with PDF**. The email goes to the customer from your
verified Brevo sender, shown as **"Your Business via Libreng Invoice"**, with the PDF attached. The seller gets a
**CC copy**, and the customer's replies go to the seller. When it's not set up, the window offers "Open in Gmail"
and "Open my email app" instead.

1. **Database:** make sure `0004_email_sending.sql` has been run.
2. **Brevo:**
   - Senders, Domains & Dedicated IPs → **Senders**: add and verify the sender address. Using your own domain
     (with DKIM) keeps emails out of spam; a free Gmail address works for testing.
   - SMTP & API → **API Keys** → generate a key. It starts with `xkeysib-`. (The SMTP key, `xsmtpsib-`, is not
     used.)
   - Settings → Security → **Authorised IPs**: deactivate blocking for API keys. Supabase's servers don't have
     fixed addresses, so Brevo would otherwise refuse them (`401 unauthorized`).
3. **Supabase Edge Function:** Edge Functions → Deploy a new function → name it exactly `send-document-email` →
   paste `supabase/functions/send-document-email/index.ts` → Deploy. (Or `supabase functions deploy
   send-document-email` with the Supabase CLI.)
4. **Supabase secrets** (Edge Functions → Secrets):

   | Name | Value |
   |---|---|
   | `BREVO_API_KEY` | The Brevo API key (`xkeysib-…`) |
   | `EMAIL_SENDER_ADDRESS` | The verified Brevo sender address |
   | `ALLOWED_ORIGINS` | The app addresses allowed to send, comma-separated, e.g. `https://your-app.vercel.app,http://localhost:5199` |

5. **Turn it on:** set `VITE_ENABLE_EMAIL_SENDING=true` in `.env.local` and in Vercel, then rebuild.

**The function's API:** `POST /functions/v1/send-document-email` · auth: the user's session token · body
`{ to, subject, message, fileName, pdfBase64 }` · replies `{ status, data, message, error, requestId }` with
200, 400, 401, 403, 429, 502 or 503.

---

## Deploying to Vercel

1. Push the code to GitHub.
2. On **vercel.com** → **Add New** → **Project** → import the repository. Vercel detects **Vite**; leave the root
   directory as `./`, the build command as `npm run build` and the output as `dist`.
3. Add the environment variables (below), then **Deploy**. Don't add Vercel's Supabase integration; the app only
   needs the variables you enter yourself.
4. Add the new address to **Supabase** (Site URL, Redirect URLs, and `ALLOWED_ORIGINS`) and to the **Google
   OAuth client** (Authorized JavaScript origins).

After that, every push to `main` redeploys automatically. Environment variables are built into the site, so after
changing one, use **Redeploy** in Vercel.

---

## Environment variables and secrets

**In the app** (`.env.local` locally, Vercel → Settings → Environment Variables when hosted). These end up in the
browser, so they must never be secrets:

| Variable | Required | Value |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | `https://<project-id>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | The **publishable** key (`sb_publishable_…`), public by design |
| `VITE_ENABLE_EMAIL_SENDING` | No | `true` once the email function is set up; otherwise `false` |

**On the server only** (Supabase → Edge Functions → Secrets): `BREVO_API_KEY`, `EMAIL_SENDER_ADDRESS`,
`ALLOWED_ORIGINS`.

**Never** put in the app or the repository: the Supabase secret / `service_role` key, the database password, the
Brevo API or SMTP keys, or the Google client secret (that one goes only in Supabase → Auth → Google).

---

## Testing and checks

```bash
npm test            # unit tests
npm run typecheck   # TypeScript
npm run lint        # oxlint
npm run build       # production build
npm audit           # known vulnerabilities in dependencies
```

The unit tests cover the parts where mistakes cost money or data: peso parsing and formatting, line totals and
unit conversion, discounts and balances, document numbering, drafts, backup validation, configuration checks,
error mapping, email message templates, PDF page splitting and the email-sending error messages.

---

## Design

The look is a **receipt pad**: warm paper, dark ink, the red of a printed receipt number and a yellow
highlighter. All colours, sizes and spacing are tokens at the top of `src/styles.css`, shared by the light and dark
themes.

- **Fonts:** Bricolage Grotesque for headings, Hanken Grotesk for text. The ₱ sign always comes from Bricolage,
  because Hanken's looks like a plain "P" at small sizes.
- **Phones first:** bottom navigation, a total bar that stays within thumb reach, large touch targets. Checked at
  320, 375, 768 and 1280 px wide, in light and dark mode.
- **Accessibility:** real buttons and labels, visible focus, keyboard-friendly dialogs (native `<dialog>`),
  status messages announced to screen readers, and no information shown by colour alone.

---

## Limits

| Limit | Value |
|---|---|
| Items per document | 50 |
| Documents per account | 10,000 |
| Amount per document | ₱9,999,999,999.99 |
| Logo | PNG, JPEG or WebP, up to 300 KB |
| Emails sent from the app | 20 per account per day, 250 in total per day |
| Saves | 60 documents and 20 profile saves per minute |
| Internet | Needed to sign in and save |

---

## Privacy and legal pages

`src/legal/legalInfo.ts` holds the facts both pages depend on: the operator name, the contact email (which must be a
monitored inbox), the "last updated" date and the list of service providers with their locations. Update it, and
the date, whenever the providers, the data collected or the contact change. The texts are a good-faith starting
point, not legal advice; have a lawyer review them before a commercial launch.

## Before going live with real customers

- **Database:** reset the database password, or create a fresh production Supabase project (Singapore region is
  closest to the Philippines) and run the migrations there.
- **Google sign-in:** publish the OAuth consent screen. While it's in Testing mode, only listed test users can
  sign in with Google.
- **Sign-up and reset emails:** Supabase's built-in sender only sends a few per hour. Connect a custom SMTP
  provider (Brevo SMTP works) in Authentication → Emails → SMTP Settings.
- **Your own domain in Brevo:** so invoice emails land in the inbox, not in spam.
- **Legal pages:** confirm the contact email in `src/legal/legalInfo.ts`, and add the Privacy Policy and Terms
  addresses to the Google OAuth consent screen.
- **Supabase plan:** the free plan pauses after about a week without activity and has no automatic backups.
  Upgrade to Pro once you have real users.
