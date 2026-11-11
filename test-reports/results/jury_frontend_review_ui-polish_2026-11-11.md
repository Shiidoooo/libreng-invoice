# Frontend Review: Libreng Invoice (whole app, UI polish)
- **Reviewer:** Jury · **Date:** 2026-11-11 · **Stack:** React 19 + TypeScript, Vite, plain CSS tokens, Supabase · **Viewports checked:** code-only (no browser available)

## Verdict
The app worked, but it read like a developer tool: the document type was hidden in a dropdown, the Save buttons sat
at the bottom of a long form, the documents list was a 7-column table that scrolled sideways on phones, and
unsaved edits could be lost without warning. All findings below are fixed. Visual verification is still pending.

## Summary
| ID | Severity | Title | Location | Status |
|----|----------|-------|----------|--------|
| FE-01 | High | Unsaved edits silently discarded by "New document", open, copy or sign-out | `src/Workspace.tsx` | Fixed: confirm dialog + beforeunload |
| FE-02 | High | Documents table forces horizontal scrolling on phones | `src/invoices/DocumentHistory.tsx` | Fixed: card list |
| FE-03 | High | Save buttons out of reach at the bottom of a long form | `src/invoices/DocumentEditor.tsx` | Fixed: sticky action bar with total |
| FE-04 | Medium | Document type buried in a dropdown, with no explanation of each type | `DocumentEditor.tsx` | Fixed: choice cards with one-line purpose |
| FE-05 | Medium | Rarely used discount/fee/payment fields always shown | `DocumentEditor.tsx` | Fixed: collapsible "Optional" section, opens on error |
| FE-06 | Medium | Header takes much of a phone screen; no thumb-reach navigation | `Workspace.tsx`, `styles.css` | Fixed: compact header + bottom nav on phones |
| FE-07 | Medium | Money fields have no currency symbol | `DocumentEditor.tsx` | Fixed: ₱ prefix (`AffixInput`) |
| FE-08 | Medium | No overview of money owed | `DocumentHistory.tsx` | Fixed: "Still to collect" summary per currency, payment filter |
| FE-09 | Medium | First-time users not told to set up business details | `Workspace.tsx` | Fixed: welcome banner with action |
| FE-10 | Low | Per-item `aria-live` regions announce every keystroke | `DocumentEditor.tsx` | Fixed: removed |
| FE-11 | Low | Paid invoices look the same as unpaid when printed | `DocumentPreview.tsx` | Fixed: PAID stamp |
| FE-12 | Low | Jargon labels ("Extra charge", "Unit price", "Duplicate") | several | Fixed: plain wording |

## What's working
Labelled fields with linked errors, keyboard-operable controls, 44px touch targets, print-only sheet, dark mode tokens,
exact centavo math.

## Not verified
No browser was available, so layouts at 375 / 768 / 1280 px, dark mode contrast and the print output were not
looked at. `:has()` (choice cards, invalid money fields) needs a 2023+ browser; older browsers lose only the highlight.
