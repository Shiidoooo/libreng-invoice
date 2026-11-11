import type { CurrencyCode } from '../money/money';

export const DOCUMENT_KINDS = ['invoice', 'quotation', 'acknowledgement_receipt', 'delivery_receipt'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export interface LineItem {
  id: string;
  description: string;
  quantityThousandths: number;
  /** Free text such as "pcs", "pack", "kg" or "hr". */
  unit: string;
  unitPriceCentavos: number;
  /**
   * The unit the price is quoted per, when it differs from `unit` (e.g. sold in "grams",
   * priced per "kg"). A unit code from units.ts, or null when the price is per `unit`.
   */
  priceUnit: string | null;
  /**
   * The line total typed by the seller instead of being computed from quantity × price
   * (e.g. 500 g of rice for ₱25). Null when the amount is computed.
   */
  enteredAmountCentavos: number | null;
}

export type Discount =
  | { kind: 'none' }
  | { kind: 'percent'; basisPoints: number }
  | { kind: 'fixed'; centavos: number };

export interface Party {
  name: string;
  address: string;
  contact: string;
}

/** One saved invoice, quotation or receipt. */
export interface BusinessDocument {
  id: string;
  kind: DocumentKind;
  /** Human-facing number such as "INV-2026-0001". Unique per kind. */
  number: string;
  /** Local calendar date, YYYY-MM-DD. */
  issueDate: string;
  /** Due date for invoices, "valid until" for quotations; null when not applicable. */
  dueDate: string | null;
  customer: Party;
  items: LineItem[];
  discount: Discount;
  /** Delivery fee, service fee or similar. Zero centavos means none. */
  otherCharge: { label: string; centavos: number };
  /** Down payment, partial payment or full payment received. */
  amountPaidCentavos: number;
  currency: CurrencyCode;
  notes: string;
  showNotOfficialReceiptNotice: boolean;
  createdAt: string;
  updatedAt: string;
}
