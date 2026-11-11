import type { CurrencyCode } from '../money/money';

export interface PaymentMethod {
  id: string;
  /** e.g. "GCash", "Maya", "BDO". */
  label: string;
  /** e.g. "0917 123 4567 – Juan Dela Cruz". */
  details: string;
}

/** The seller's details, printed on every document. */
export interface BusinessProfile {
  name: string;
  address: string;
  phone: string;
  email: string;
  /** Optional. Printed only when filled in. */
  tin: string;
  /** A validated PNG/JPEG/WebP data URL, or null. */
  logoDataUrl: string | null;
  paymentMethods: PaymentMethod[];
  defaultCurrency: CurrencyCode;
  defaultNotes: string;
  /** Email template for sending documents; blank means the built-in one. */
  emailSubject: string;
  emailMessage: string;
}

export const EMPTY_PROFILE: BusinessProfile = {
  name: '',
  address: '',
  phone: '',
  email: '',
  tin: '',
  logoDataUrl: null,
  paymentMethods: [],
  defaultCurrency: 'PHP',
  defaultNotes: 'Thank you for your business!',
  emailSubject: '',
  emailMessage: '',
};
