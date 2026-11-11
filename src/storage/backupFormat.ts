import { MAX_LOGO_DATA_URL_LENGTH, isAllowedLogoDataUrl } from '../business/logo';
import type { BusinessProfile, PaymentMethod } from '../business/types';
import { isValidDateString } from '../dates/dates';
import { MAX_DOCUMENT_AMOUNT_CENTAVOS, MAX_LINE_AMOUNT_CENTAVOS, MAX_LINE_ITEMS, TEXT_LIMITS } from '../invoices/draft';
import { computeLineAmount } from '../invoices/totals';
import { conversionRatio } from '../invoices/units';
import type { NumberCounters } from '../invoices/numbering';
import { DOCUMENT_KINDS, type BusinessDocument, type Discount, type LineItem, type Party } from '../invoices/types';
import {
  CURRENCIES,
  MAX_PERCENT_BASIS_POINTS,
  MAX_QUANTITY_THOUSANDTHS,
  MAX_UNIT_PRICE_CENTAVOS,
} from '../money/money';

export const BACKUP_APP_ID = 'invoice-generator';
export const BACKUP_VERSION = 1;
/** Large enough for thousands of documents, small enough not to freeze the tab. */
export const MAX_BACKUP_FILE_BYTES = 20 * 1024 * 1024;
const MAX_DOCUMENTS_IN_BACKUP = 20_000;
const MAX_PAYMENT_METHODS = 10;
const MAX_ID_LENGTH = 64;
const MAX_PROFILE_TEXT = 300;
const MAX_TIMESTAMP_LENGTH = 40;

export interface Backup {
  app: typeof BACKUP_APP_ID;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  profile: BusinessProfile;
  counters: NumberCounters;
  documents: BusinessDocument[];
}

/**
 * A backup file comes from outside the app (it may be edited or from someone else),
 * so every field is checked against the same limits the editor enforces.
 * Throws BackupFormatError with a plain-language message on the first problem.
 */
export class BackupFormatError extends Error {}

type UnknownObject = Record<string, unknown>;

function fail(path: string, problem: string): never {
  throw new BackupFormatError(`Invalid backup file: ${path} ${problem}.`);
}

function asObject(value: unknown, path: string): UnknownObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'must be an object');
  return value as UnknownObject;
}

function asString(value: unknown, path: string, maxLength: number): string {
  if (typeof value !== 'string') fail(path, 'must be text');
  if (value.length > maxLength) fail(path, `is longer than ${maxLength} characters`);
  return value;
}

function asInteger(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    fail(path, `must be a whole number from ${min} to ${max}`);
  }
  return value;
}

function asBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') fail(path, 'must be true or false');
  return value;
}

function asArray(value: unknown, path: string, maxLength: number): unknown[] {
  if (!Array.isArray(value)) fail(path, 'must be a list');
  if (value.length > maxLength) fail(path, `has more than ${maxLength} entries`);
  return value;
}

function asOneOf<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    fail(path, `must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

function asDate(value: unknown, path: string): string {
  const text = asString(value, path, 10);
  if (!isValidDateString(text)) fail(path, 'must be a date like 2026-01-31');
  return text;
}

function asTimestamp(value: unknown, path: string): string {
  const text = asString(value, path, MAX_TIMESTAMP_LENGTH);
  if (Number.isNaN(Date.parse(text))) fail(path, 'must be a timestamp');
  return text;
}

function parseParty(value: unknown, path: string): Party {
  const party = asObject(value, path);
  return {
    name: asString(party.name, `${path}.name`, TEXT_LIMITS.partyName),
    address: asString(party.address, `${path}.address`, TEXT_LIMITS.partyAddress),
    contact: asString(party.contact, `${path}.contact`, TEXT_LIMITS.partyContact),
  };
}

function parseLineItem(value: unknown, path: string): LineItem {
  const item = asObject(value, path);
  const unit = asString(item.unit, `${path}.unit`, TEXT_LIMITS.itemUnit);
  // Documents saved before price units existed have no priceUnit field.
  let priceUnit: string | null = null;
  if (item.priceUnit !== undefined && item.priceUnit !== null) {
    priceUnit = asString(item.priceUnit, `${path}.priceUnit`, TEXT_LIMITS.itemUnit);
    if (!conversionRatio(unit, priceUnit)) fail(`${path}.priceUnit`, `cannot be converted from "${unit}"`);
  }
  const lineItem: LineItem = {
    id: asString(item.id, `${path}.id`, MAX_ID_LENGTH),
    description: asString(item.description, `${path}.description`, TEXT_LIMITS.itemDescription),
    quantityThousandths: asInteger(item.quantityThousandths, `${path}.quantityThousandths`, 1, MAX_QUANTITY_THOUSANDTHS),
    unit,
    unitPriceCentavos: asInteger(item.unitPriceCentavos, `${path}.unitPriceCentavos`, 0, MAX_UNIT_PRICE_CENTAVOS),
    priceUnit,
  };
  if (computeLineAmount(lineItem) > MAX_LINE_AMOUNT_CENTAVOS) fail(path, 'has an amount that is too large');
  return lineItem;
}

function parseDiscount(value: unknown, path: string): Discount {
  const discount = asObject(value, path);
  const kind = asOneOf(discount.kind, `${path}.kind`, ['none', 'percent', 'fixed'] as const);
  if (kind === 'percent') {
    return { kind, basisPoints: asInteger(discount.basisPoints, `${path}.basisPoints`, 0, MAX_PERCENT_BASIS_POINTS) };
  }
  if (kind === 'fixed') {
    return { kind, centavos: asInteger(discount.centavos, `${path}.centavos`, 0, MAX_DOCUMENT_AMOUNT_CENTAVOS) };
  }
  return { kind };
}

export function parseDocument(value: unknown, path: string): BusinessDocument {
  const doc = asObject(value, path);
  const otherCharge = asObject(doc.otherCharge, `${path}.otherCharge`);
  return {
    id: asString(doc.id, `${path}.id`, MAX_ID_LENGTH),
    kind: asOneOf(doc.kind, `${path}.kind`, DOCUMENT_KINDS),
    number: asString(doc.number, `${path}.number`, TEXT_LIMITS.number),
    issueDate: asDate(doc.issueDate, `${path}.issueDate`),
    dueDate: doc.dueDate === null ? null : asDate(doc.dueDate, `${path}.dueDate`),
    customer: parseParty(doc.customer, `${path}.customer`),
    items: asArray(doc.items, `${path}.items`, MAX_LINE_ITEMS).map((item, i) => parseLineItem(item, `${path}.items[${i}]`)),
    discount: parseDiscount(doc.discount, `${path}.discount`),
    otherCharge: {
      label: asString(otherCharge.label, `${path}.otherCharge.label`, TEXT_LIMITS.chargeLabel),
      centavos: asInteger(otherCharge.centavos, `${path}.otherCharge.centavos`, 0, MAX_UNIT_PRICE_CENTAVOS),
    },
    amountPaidCentavos: asInteger(doc.amountPaidCentavos, `${path}.amountPaidCentavos`, 0, MAX_DOCUMENT_AMOUNT_CENTAVOS),
    currency: asOneOf(doc.currency, `${path}.currency`, CURRENCIES),
    notes: asString(doc.notes, `${path}.notes`, TEXT_LIMITS.notes),
    showNotOfficialReceiptNotice: asBoolean(doc.showNotOfficialReceiptNotice, `${path}.showNotOfficialReceiptNotice`),
    createdAt: asTimestamp(doc.createdAt, `${path}.createdAt`),
    updatedAt: asTimestamp(doc.updatedAt, `${path}.updatedAt`),
  };
}

function parsePaymentMethod(value: unknown, path: string): PaymentMethod {
  const method = asObject(value, path);
  return {
    id: asString(method.id, `${path}.id`, MAX_ID_LENGTH),
    label: asString(method.label, `${path}.label`, TEXT_LIMITS.chargeLabel),
    details: asString(method.details, `${path}.details`, MAX_PROFILE_TEXT),
  };
}

export function parseProfile(value: unknown, path = 'profile'): BusinessProfile {
  const profile = asObject(value, path);
  let logoDataUrl: string | null = null;
  if (profile.logoDataUrl !== null) {
    logoDataUrl = asString(profile.logoDataUrl, `${path}.logoDataUrl`, MAX_LOGO_DATA_URL_LENGTH);
    if (!isAllowedLogoDataUrl(logoDataUrl)) fail(`${path}.logoDataUrl`, 'must be a PNG, JPEG or WebP image');
  }
  return {
    name: asString(profile.name, `${path}.name`, TEXT_LIMITS.partyName),
    address: asString(profile.address, `${path}.address`, MAX_PROFILE_TEXT),
    phone: asString(profile.phone, `${path}.phone`, TEXT_LIMITS.partyContact),
    email: asString(profile.email, `${path}.email`, TEXT_LIMITS.partyContact),
    tin: asString(profile.tin, `${path}.tin`, TEXT_LIMITS.number),
    logoDataUrl,
    paymentMethods: asArray(profile.paymentMethods, `${path}.paymentMethods`, MAX_PAYMENT_METHODS).map((method, i) =>
      parsePaymentMethod(method, `${path}.paymentMethods[${i}]`),
    ),
    defaultCurrency: asOneOf(profile.defaultCurrency, `${path}.defaultCurrency`, CURRENCIES),
    defaultNotes: asString(profile.defaultNotes, `${path}.defaultNotes`, TEXT_LIMITS.notes),
  };
}

const COUNTER_KEY_PATTERN = new RegExp(`^(${DOCUMENT_KINDS.join('|')}):\\d{4}$`);

function parseCounters(value: unknown, path: string): NumberCounters {
  const counters = asObject(value, path);
  const result: NumberCounters = {};
  for (const [key, sequence] of Object.entries(counters)) {
    if (!COUNTER_KEY_PATTERN.test(key)) fail(`${path}.${key}`, 'is not a known counter');
    result[key] = asInteger(sequence, `${path}.${key}`, 0, 99_999_999);
  }
  return result;
}

/** Parses the text of a backup file. Throws BackupFormatError when anything is off. */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupFormatError('This file is not a valid backup (it is not JSON).');
  }
  const backup = asObject(raw, 'file');
  if (backup.app !== BACKUP_APP_ID) throw new BackupFormatError('This file is not a backup from this app.');
  if (backup.version !== BACKUP_VERSION) {
    throw new BackupFormatError(`This backup uses version ${String(backup.version)}, which this app cannot read.`);
  }
  const documents = asArray(backup.documents, 'documents', MAX_DOCUMENTS_IN_BACKUP).map((doc, i) =>
    parseDocument(doc, `documents[${i}]`),
  );
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: asTimestamp(backup.exportedAt, 'exportedAt'),
    profile: parseProfile(backup.profile),
    counters: parseCounters(backup.counters, 'counters'),
    documents,
  };
}
