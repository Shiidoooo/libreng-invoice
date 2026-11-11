import { describe, expect, it } from 'vitest';
import { EMPTY_PROFILE, type BusinessProfile } from '../business/types';
import {
  DEFAULT_EMAIL_MESSAGE,
  DEFAULT_EMAIL_SUBJECT,
  buildEmail,
  buildGmailLink,
  buildMailtoLink,
  fillTemplate,
  findEmailAddress,
  isEmailAddress,
  resolveEmailTemplate,
  toStoredEmailTemplate,
} from './emailMessage';
import type { BusinessDocument } from './types';

const PROFILE: BusinessProfile = {
  ...EMPTY_PROFILE,
  name: 'Aling Nena Store',
  phone: '0917 123 4567',
  paymentMethods: [{ id: 'p1', label: 'GCash', details: '0917 123 4567 – Nena Cruz' }],
};

function invoice(overrides: Partial<BusinessDocument> = {}): BusinessDocument {
  return {
    id: 'd1',
    kind: 'invoice',
    number: 'INV-2026-0012',
    issueDate: '2026-11-11',
    dueDate: '2026-11-26',
    customer: { name: 'Ana Reyes', address: '', contact: '0918 000 0000 / ana@example.com' },
    items: [
      { id: 'i1', description: 'Rice', quantityThousandths: 2000, unit: 'kg', unitPriceCentavos: 5000, priceUnit: null, enteredAmountCentavos: null },
    ],
    discount: { kind: 'none' },
    otherCharge: { label: '', centavos: 0 },
    amountPaidCentavos: 0,
    currency: 'PHP',
    notes: '',
    showNotOfficialReceiptNotice: true,
    createdAt: '2026-11-11T00:00:00.000Z',
    updatedAt: '2026-11-11T00:00:00.000Z',
    ...overrides,
  };
}

describe('fillTemplate', () => {
  it('replaces known placeholders and keeps unknown ones as typed', () => {
    expect(fillTemplate('Hi {customer}, see {nope}', { customer: 'Ana' })).toBe('Hi Ana, see {nope}');
  });

  it('drops a line whose placeholders are empty, with its heading line', () => {
    const result = fillTemplate('Hi\n\nYou can pay through:\n{payment_methods}\n\nThanks', { payment_methods: '' });
    expect(result).toBe('Hi\n\nThanks');
  });

  it('keeps a line when at least one of its placeholders has a value', () => {
    expect(fillTemplate('{business} {business_phone}', { business: 'Store', business_phone: '' })).toBe('Store');
  });

  it('does not treat inherited object keys as placeholders', () => {
    expect(fillTemplate('{constructor}', {})).toBe('{constructor}');
  });
});

describe('buildEmail', () => {
  it('fills the built-in template for an unpaid invoice', () => {
    const email = buildEmail(invoice(), PROFILE);
    expect(email.to).toBe('ana@example.com');
    expect(email.subject).toBe('Invoice INV-2026-0012 from Aling Nena Store');
    expect(email.message).toContain('Hi Ana Reyes,');
    expect(email.message).toContain('Total: ₱100.00');
    expect(email.message).toContain('Due date: November 26, 2026');
    expect(email.message).toContain('You can pay through:\n- GCash: 0917 123 4567 – Nena Cruz');
    // Nothing paid yet, so a separate balance line would only repeat the total.
    expect(email.message).not.toContain('Balance due');
  });

  it('shows the balance after a down payment', () => {
    expect(buildEmail(invoice({ amountPaidCentavos: 4000 }), PROFILE).message).toContain('Balance due: ₱60.00');
  });

  it('leaves out the due date and payment options once fully paid', () => {
    const message = buildEmail(invoice({ amountPaidCentavos: 10000 }), PROFILE).message;
    expect(message).not.toContain('Due date');
    expect(message).not.toContain('pay through');
  });

  it('uses "Valid until" for quotations', () => {
    expect(buildEmail(invoice({ kind: 'quotation', number: 'QUO-2026-0001' }), PROFILE).message).toContain(
      'Valid until: November 26, 2026',
    );
  });

  it('uses the seller’s own template when set', () => {
    const email = buildEmail(invoice(), { ...PROFILE, emailSubject: 'Bill {number}', emailMessage: 'Salamat, {customer}!' });
    expect(email).toMatchObject({ subject: 'Bill INV-2026-0012', message: 'Salamat, Ana Reyes!' });
  });

  it('leaves the recipient empty when the contact has no email address', () => {
    expect(buildEmail(invoice({ customer: { name: 'Ana', address: '', contact: '0918 000 0000' } }), PROFILE).to).toBe('');
  });
});

describe('templates stored per account', () => {
  it('treats blank as the built-in template and stores the built-in one as blank', () => {
    expect(resolveEmailTemplate({ emailSubject: ' ', emailMessage: '' })).toEqual({
      subject: DEFAULT_EMAIL_SUBJECT,
      message: DEFAULT_EMAIL_MESSAGE,
    });
    expect(toStoredEmailTemplate({ subject: DEFAULT_EMAIL_SUBJECT, message: 'Mine' })).toEqual({ subject: '', message: 'Mine' });
  });
});

describe('links', () => {
  const email = { to: 'ana@example.com', subject: 'Invoice & receipt', message: 'Line 1\nLine 2' };

  it('builds a mailto link with encoded text and CRLF line breaks', () => {
    expect(buildMailtoLink(email)).toBe('mailto:ana%40example.com?subject=Invoice%20%26%20receipt&body=Line%201%0D%0ALine%202');
  });

  it('never puts an invalid address (or extra mailto fields) in the recipient', () => {
    expect(buildMailtoLink({ ...email, to: 'x@y.com?bcc=z@w.com' })).toMatch(/^mailto:\?subject=/);
    expect(buildGmailLink({ ...email, to: 'not an email' })).not.toContain('to=');
  });

  it('builds a Gmail compose link', () => {
    const url = new URL(buildGmailLink(email));
    expect(url.origin).toBe('https://mail.google.com');
    expect(url.searchParams.get('to')).toBe('ana@example.com');
    expect(url.searchParams.get('body')).toBe('Line 1\nLine 2');
  });
});

describe('email addresses', () => {
  it('finds and validates addresses', () => {
    expect(findEmailAddress('call 0917 or ana.r+shop@mail.co.ph')).toBe('ana.r+shop@mail.co.ph');
    expect(findEmailAddress('0917 123 4567')).toBe('');
    expect(isEmailAddress(' ana@example.com ')).toBe(true);
    expect(isEmailAddress('ana@example')).toBe(false);
  });
});
