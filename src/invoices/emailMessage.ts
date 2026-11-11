/**
 * Builds the email a seller sends to a customer about a document, from a template the
 * seller can edit in My business. The email is sent from the seller's own email app or
 * Gmail (a mailto: or Gmail compose link), so it really comes from their address and the
 * app never sends mail itself.
 */
import type { BusinessProfile } from '../business/types';
import { formatDisplayDate } from '../dates/dates';
import { formatMoney } from '../money/money';
import { DOCUMENT_KIND_CONFIG } from './documentKinds';
import { computeTotals } from './totals';
import type { BusinessDocument } from './types';

export const EMAIL_SUBJECT_MAX_LENGTH = 200;
export const EMAIL_MESSAGE_MAX_LENGTH = 2000;

export const DEFAULT_EMAIL_SUBJECT = '{document} {number} from {business}';

export const DEFAULT_EMAIL_MESSAGE = `Hi {customer},

Here is your {document} {number} dated {date}. I have attached the PDF.

Total: {total}
Balance due: {balance}
{due}

You can pay through:
{payment_methods}

Thank you!
{business}
{business_phone}`;

/** Placeholders shown to the seller, in the order they are listed in My business. */
export const EMAIL_PLACEHOLDERS = [
  { key: 'customer', meaning: 'customer name' },
  { key: 'document', meaning: 'Invoice, Quotation…' },
  { key: 'number', meaning: 'document number' },
  { key: 'date', meaning: 'issue date' },
  { key: 'total', meaning: 'total amount' },
  { key: 'balance', meaning: 'amount still to pay' },
  { key: 'due', meaning: '“Due date: …” or “Valid until: …”' },
  { key: 'payment_methods', meaning: 'your GCash, bank… one per line' },
  { key: 'business', meaning: 'your business name' },
  { key: 'business_phone', meaning: 'your phone' },
  { key: 'business_email', meaning: 'your email' },
] as const;

type PlaceholderKey = (typeof EMAIL_PLACEHOLDERS)[number]['key'];

export interface EmailTemplate {
  subject: string;
  message: string;
}

export interface EmailContent {
  to: string;
  subject: string;
  message: string;
}

/** The seller's template, or the built-in one where they left it blank. */
export function resolveEmailTemplate(profile: Pick<BusinessProfile, 'emailSubject' | 'emailMessage'>): EmailTemplate {
  return {
    subject: profile.emailSubject.trim() === '' ? DEFAULT_EMAIL_SUBJECT : profile.emailSubject,
    message: profile.emailMessage.trim() === '' ? DEFAULT_EMAIL_MESSAGE : profile.emailMessage,
  };
}

/** Stored as blank when it matches the built-in template, so later improvements to it reach the seller. */
export function toStoredEmailTemplate(template: EmailTemplate): EmailTemplate {
  return {
    subject: template.subject === DEFAULT_EMAIL_SUBJECT ? '' : template.subject,
    message: template.message === DEFAULT_EMAIL_MESSAGE ? '' : template.message,
  };
}

const EMAIL_ADDRESS_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

/** The first email address in free text such as "0917 123 4567 / ana@example.com", or ''. */
export function findEmailAddress(text: string): string {
  return EMAIL_ADDRESS_PATTERN.exec(text)?.[0] ?? '';
}

export function isEmailAddress(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length <= 254 && new RegExp(`^${EMAIL_ADDRESS_PATTERN.source}$`).test(trimmed);
}

function placeholderValues(doc: BusinessDocument, profile: BusinessProfile): Record<PlaceholderKey, string> {
  const config = DOCUMENT_KIND_CONFIG[doc.kind];
  const totals = computeTotals(doc);
  const money = (centavos: number) => formatMoney(centavos, doc.currency);
  // A balance is worth mentioning only when part was paid and something is still owed;
  // otherwise it would just repeat the total (or say ₱0.00).
  const hasBalance = config.amountPaidLabel !== null && totals.amountPaid > 0 && totals.balanceDue > 0;
  const isFullyPaid = config.amountPaidLabel !== null && totals.total > 0 && totals.balanceDue === 0;
  const paymentMethods =
    config.showsPaymentMethods && !isFullyPaid
      ? profile.paymentMethods
          .filter((method) => method.label.trim() || method.details.trim())
          .map((method) => `- ${[method.label.trim(), method.details.trim()].filter(Boolean).join(': ')}`)
          .join('\n')
      : '';

  return {
    customer: doc.customer.name.trim(),
    document: config.title,
    number: doc.number,
    date: formatDisplayDate(doc.issueDate),
    total: money(totals.total),
    balance: hasBalance ? money(totals.balanceDue) : '',
    due: config.dueDateLabel && doc.dueDate && !isFullyPaid ? `${config.dueDateLabel}: ${formatDisplayDate(doc.dueDate)}` : '',
    payment_methods: paymentMethods,
    business: profile.name.trim(),
    business_phone: profile.phone.trim(),
    business_email: profile.email.trim(),
  };
}

const PLACEHOLDER_PATTERN = /\{([a-z_]+)\}/g;

/**
 * Fills the placeholders. A line whose placeholders are all empty is left out, together
 * with a heading line ending in ":" right above it, so "Balance due:" or "You can pay
 * through:" never appear with nothing after them. Unknown placeholders stay as typed.
 */
export function fillTemplate(template: string, values: Record<string, string>): string {
  const lines = template.replace(/\r\n?/g, '\n').split('\n');
  const output: string[] = [];
  for (const line of lines) {
    let hasPlaceholder = false;
    let hasFilledPlaceholder = false;
    const filled = line.replace(PLACEHOLDER_PATTERN, (match, key: string) => {
      if (!Object.hasOwn(values, key)) return match;
      hasPlaceholder = true;
      const value = values[key] ?? '';
      if (value !== '') hasFilledPlaceholder = true;
      return value;
    });
    if (hasPlaceholder && !hasFilledPlaceholder) {
      const previous = output.at(-1);
      if (previous !== undefined && previous.trim().endsWith(':')) output.pop();
      continue;
    }
    output.push(filled.trimEnd());
  }
  // Removed lines can leave stacked or leading blank lines behind.
  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function buildEmail(doc: BusinessDocument, profile: BusinessProfile): EmailContent {
  const template = resolveEmailTemplate(profile);
  const values = placeholderValues(doc, profile);
  return {
    to: findEmailAddress(doc.customer.contact),
    subject: fillTemplate(template.subject, values).replace(/\s+/g, ' ').slice(0, EMAIL_SUBJECT_MAX_LENGTH),
    message: fillTemplate(template.message, values),
  };
}

/** Email apps expect CRLF line breaks in mailto: bodies (RFC 6068). */
function encodeMailtoText(text: string): string {
  return encodeURIComponent(text.replace(/\r?\n/g, '\r\n'));
}

/** Opens the device's default email app. Only a valid address is put in the "to" part. */
export function buildMailtoLink(email: EmailContent): string {
  const to = isEmailAddress(email.to) ? encodeURIComponent(email.to.trim()) : '';
  return `mailto:${to}?subject=${encodeMailtoText(email.subject)}&body=${encodeMailtoText(email.message)}`;
}

/** Opens a new message in Gmail on the web (or the Gmail app on phones). */
export function buildGmailLink(email: EmailContent): string {
  const params = new URLSearchParams({ view: 'cm', fs: '1', su: email.subject, body: email.message });
  if (isEmailAddress(email.to)) params.set('to', email.to.trim());
  return `https://mail.google.com/mail/?${params.toString()}`;
}

/** Some email apps on Windows cut off mailto: links longer than about 2,000 characters. */
export const MAILTO_SAFE_LENGTH = 2000;
