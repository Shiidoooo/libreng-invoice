# Libreng Invoice

A free invoice, quotation and receipt maker for sari-sari stores, small businesses and freelancers.
There's no sign-up and no subscription, and **your data never leaves your device**: everything is saved in
the browser's own database (IndexedDB).

## What it does

- **Documents:** Invoice, Quotation, Acknowledgement Receipt, Delivery Receipt
- **Automatic numbering** per type and year (`INV-2026-0001`, `QUO-2026-0001`, …). You can also type your own.
- **Line items** with units (pcs, pack, kg, hr, …), discount (percent or fixed), an extra charge
  (delivery or rush fee), and down payment or partial payment with balance due
- **Business profile:** logo, address, optional TIN, and payment options (GCash, Maya, banks)
- **PDF download** through the browser's print dialog ("Save as PDF")
- **History:** search, filter, duplicate, mark as paid, delete
- **Backup and restore** as a JSON file, to move data to another device or keep a copy safe
- Currencies: PHP (default), USD, EUR, GBP, SGD, AUD, CAD, HKD, AED, SAR

Documents print "This document is not an official receipt." by default. They are not BIR-registered
invoices or official receipts.

## Development

Requires Node 24+.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run typecheck
npm run lint
npm run build      # production build in dist/
```

## Project layout

```
src/
  money/      centavo-based money parsing and formatting (no floating-point totals)
  dates/      local YYYY-MM-DD date helpers
  invoices/   document model, totals, numbering, editor/preview/history screens
  business/   business profile, logo validation, settings screen
  storage/    IndexedDB access and backup file validation (the only module that touches storage)
  ui/         shared form field component
```

### Design decisions

- **Money is stored as integer centavos** and quantities as integer thousandths. Line amounts use BigInt
  and round half up, so a total is never off by a centavo.
- **No server.** Running it costs nothing, and the app holds no one else's customer data. Because storage
  sits behind `src/storage/database.ts`, optional cloud sync could be added later without changing the screens.
- **Document numbers are unique per type**, enforced by a unique IndexedDB index. The number and its
  counter are saved in the same transaction.
- **Backup files are untrusted input.** Every field is type- and length-checked before import, and logos
  must be PNG, JPEG or WebP (checked by the file's bytes, not its name). Import merges and never deletes.

## Deploying

`npm run build`, then upload `dist/` to any static host (Cloudflare Pages, Netlify, GitHub Pages).
`public/_headers` sets a strict Content-Security-Policy and other security headers on Cloudflare Pages and
Netlify. On other hosts, configure the same headers.
