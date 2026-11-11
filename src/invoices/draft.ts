import type { BusinessProfile } from '../business/types';
import { addDays, isValidDateString } from '../dates/dates';
import {
  basisPointsToPlainText,
  centavosToPlainText,
  parseMoney,
  parsePercent,
  parseQuantity,
  quantityToPlainText,
  type CurrencyCode,
  type ParseResult,
} from '../money/money';
import { DOCUMENT_KIND_CONFIG } from './documentKinds';
import { suggestNextNumber, type NumberCounters } from './numbering';
import type { BusinessDocument, Discount, DocumentKind, LineItem, Party } from './types';

export const MAX_LINE_ITEMS = 50;
/** Upper bound for paid amounts and fixed discounts: ₱9,999,999,999.99. */
export const MAX_DOCUMENT_AMOUNT_CENTAVOS = 999_999_999_999;
export const DEFAULT_DUE_IN_DAYS = 15;

export const TEXT_LIMITS = {
  number: 40,
  partyName: 120,
  partyAddress: 300,
  partyContact: 120,
  itemDescription: 200,
  itemUnit: 20,
  chargeLabel: 60,
  notes: 1000,
} as const;

/** Editor state. Numeric fields stay as typed text so a half-typed "12." is not lost. */
export interface LineItemDraft {
  id: string;
  description: string;
  quantityText: string;
  unit: string;
  unitPriceText: string;
}

export interface DocumentDraft {
  id: string;
  isNew: boolean;
  createdAt: string | null;
  kind: DocumentKind;
  number: string;
  issueDate: string;
  /** Empty string means no due date. */
  dueDate: string;
  customer: Party;
  items: LineItemDraft[];
  discountKind: Discount['kind'];
  discountText: string;
  otherChargeLabel: string;
  otherChargeText: string;
  amountPaidText: string;
  currency: CurrencyCode;
  notes: string;
  showNotOfficialReceiptNotice: boolean;
}

/** Field path → message, e.g. "number" or "items.<id>.quantity". */
export type DraftErrors = Record<string, string>;

export function createEmptyLineItem(id: string): LineItemDraft {
  return { id, description: '', quantityText: '1', unit: 'pcs', unitPriceText: '' };
}

interface NewDraftOptions {
  kind: DocumentKind;
  today: string;
  counters: NumberCounters;
  profile: BusinessProfile;
  createId: () => string;
}

export function createNewDraft({ kind, today, counters, profile, createId }: NewDraftOptions): DocumentDraft {
  return {
    id: createId(),
    isNew: true,
    createdAt: null,
    kind,
    number: suggestNextNumber(counters, kind, Number(today.slice(0, 4))),
    issueDate: today,
    dueDate: DOCUMENT_KIND_CONFIG[kind].dueDateLabel ? addDays(today, DEFAULT_DUE_IN_DAYS) : '',
    customer: { name: '', address: '', contact: '' },
    items: [createEmptyLineItem(createId())],
    discountKind: 'none',
    discountText: '',
    otherChargeLabel: 'Delivery fee',
    otherChargeText: '',
    amountPaidText: '',
    currency: profile.defaultCurrency,
    notes: profile.defaultNotes,
    showNotOfficialReceiptNotice: true,
  };
}

export function draftFromDocument(doc: BusinessDocument): DocumentDraft {
  return {
    id: doc.id,
    isNew: false,
    createdAt: doc.createdAt,
    kind: doc.kind,
    number: doc.number,
    issueDate: doc.issueDate,
    dueDate: doc.dueDate ?? '',
    customer: { ...doc.customer },
    items: doc.items.map((item) => ({
      id: item.id,
      description: item.description,
      quantityText: quantityToPlainText(item.quantityThousandths),
      unit: item.unit,
      unitPriceText: centavosToPlainText(item.unitPriceCentavos),
    })),
    discountKind: doc.discount.kind,
    discountText:
      doc.discount.kind === 'percent'
        ? basisPointsToPlainText(doc.discount.basisPoints)
        : doc.discount.kind === 'fixed'
          ? centavosToPlainText(doc.discount.centavos)
          : '',
    otherChargeLabel: doc.otherCharge.label,
    otherChargeText: doc.otherCharge.centavos > 0 ? centavosToPlainText(doc.otherCharge.centavos) : '',
    amountPaidText: doc.amountPaidCentavos > 0 ? centavosToPlainText(doc.amountPaidCentavos) : '',
    currency: doc.currency,
    notes: doc.notes,
    showNotOfficialReceiptNotice: doc.showNotOfficialReceiptNotice,
  };
}

/** A copy of an existing document as a new, unpaid one with today's dates and the next number. */
export function duplicateAsDraft(
  doc: BusinessDocument,
  { today, counters, createId }: Omit<NewDraftOptions, 'kind' | 'profile'>,
): DocumentDraft {
  const source = draftFromDocument(doc);
  return {
    ...source,
    id: createId(),
    isNew: true,
    createdAt: null,
    number: suggestNextNumber(counters, doc.kind, Number(today.slice(0, 4))),
    issueDate: today,
    dueDate: DOCUMENT_KIND_CONFIG[doc.kind].dueDateLabel ? addDays(today, DEFAULT_DUE_IN_DAYS) : '',
    items: source.items.map((item) => ({ ...item, id: createId() })),
    amountPaidText: '',
  };
}

export interface DraftConversion {
  /** Always usable for the live preview; invalid numeric fields count as zero. */
  document: BusinessDocument;
  errors: DraftErrors;
  isValid: boolean;
}

/** Validates the draft and converts it into a document. `now` is an ISO timestamp. */
export function convertDraft(draft: DocumentDraft, now: string): DraftConversion {
  const errors: DraftErrors = {};
  const config = DOCUMENT_KIND_CONFIG[draft.kind];

  const readNumber = (field: string, result: ParseResult): number => {
    if (result.isValid) return result.value;
    errors[field] = result.error;
    return 0;
  };
  const checkLength = (field: string, value: string, max: number) => {
    if (value.length > max) errors[field] = `Keep this under ${max} characters`;
  };

  const number = draft.number.trim();
  if (number === '') errors.number = 'Required';
  checkLength('number', number, TEXT_LIMITS.number);

  if (!isValidDateString(draft.issueDate)) errors.issueDate = 'Enter a valid date';
  const hasDueDate = config.dueDateLabel !== null && draft.dueDate !== '';
  if (hasDueDate && !isValidDateString(draft.dueDate)) errors.dueDate = 'Enter a valid date';

  checkLength('customer.name', draft.customer.name, TEXT_LIMITS.partyName);
  checkLength('customer.address', draft.customer.address, TEXT_LIMITS.partyAddress);
  checkLength('customer.contact', draft.customer.contact, TEXT_LIMITS.partyContact);

  if (draft.items.length === 0) errors.items = 'Add at least one item';
  if (draft.items.length > MAX_LINE_ITEMS) errors.items = `Up to ${MAX_LINE_ITEMS} items per document`;

  const items: LineItem[] = draft.items.map((item) => {
    const prefix = `items.${item.id}`;
    const description = item.description.trim();
    if (description === '') errors[`${prefix}.description`] = 'Required';
    checkLength(`${prefix}.description`, description, TEXT_LIMITS.itemDescription);
    checkLength(`${prefix}.unit`, item.unit, TEXT_LIMITS.itemUnit);
    return {
      id: item.id,
      description,
      quantityThousandths: readNumber(`${prefix}.quantity`, parseQuantity(item.quantityText)),
      unit: item.unit.trim(),
      unitPriceCentavos: readNumber(`${prefix}.unitPrice`, parseMoney(item.unitPriceText)),
    };
  });

  let discount: Discount = { kind: 'none' };
  if (draft.discountKind === 'percent') {
    discount = { kind: 'percent', basisPoints: readNumber('discount', parsePercent(draft.discountText)) };
  } else if (draft.discountKind === 'fixed') {
    discount = {
      kind: 'fixed',
      centavos: readNumber('discount', parseMoney(draft.discountText, MAX_DOCUMENT_AMOUNT_CENTAVOS)),
    };
  }

  checkLength('otherChargeLabel', draft.otherChargeLabel, TEXT_LIMITS.chargeLabel);
  const otherChargeCentavos = readNumber('otherCharge', parseMoney(draft.otherChargeText));

  const amountPaidCentavos =
    config.amountPaidLabel === null
      ? 0
      : readNumber('amountPaid', parseMoney(draft.amountPaidText, MAX_DOCUMENT_AMOUNT_CENTAVOS));

  checkLength('notes', draft.notes, TEXT_LIMITS.notes);

  const document: BusinessDocument = {
    id: draft.id,
    kind: draft.kind,
    number,
    issueDate: draft.issueDate,
    dueDate: hasDueDate ? draft.dueDate : null,
    customer: {
      name: draft.customer.name.trim(),
      address: draft.customer.address.trim(),
      contact: draft.customer.contact.trim(),
    },
    items,
    discount,
    otherCharge: { label: draft.otherChargeLabel.trim() || 'Other charge', centavos: otherChargeCentavos },
    amountPaidCentavos,
    currency: draft.currency,
    notes: draft.notes.trim(),
    showNotOfficialReceiptNotice: draft.showNotOfficialReceiptNotice,
    createdAt: draft.createdAt ?? now,
    updatedAt: now,
  };

  return { document, errors, isValid: Object.keys(errors).length === 0 };
}
