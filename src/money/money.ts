/**
 * Money is stored as integer centavos (1/100 of the currency unit) and
 * quantities as integer thousandths, so totals never suffer floating-point
 * drift such as 0.1 + 0.2 = 0.30000000000000004.
 */

export const CURRENCIES = ['PHP', 'USD', 'EUR', 'GBP', 'SGD', 'AUD', 'CAD', 'HKD', 'AED', 'SAR'] as const;
export type CurrencyCode = (typeof CURRENCIES)[number];

/** ₱9,999,999.99 per unit. Together with MAX_QUANTITY_THOUSANDTHS and MAX_LINE_ITEMS this keeps every total below Number.MAX_SAFE_INTEGER. */
export const MAX_UNIT_PRICE_CENTAVOS = 999_999_999;
/** 99,999.999 units. */
export const MAX_QUANTITY_THOUSANDTHS = 99_999_999;
/** 100.00% expressed in basis points (1 bp = 0.01%). */
export const MAX_PERCENT_BASIS_POINTS = 10_000;

const MONEY_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
const QUANTITY_PATTERN = /^\d{1,6}(\.\d{1,3})?$/;
const PERCENT_PATTERN = /^\d{1,3}(\.\d{1,2})?$/;

export type ParseResult = { isValid: true; value: number } | { isValid: false; error: string };

function stripFormatting(input: string): string {
  return input.trim().replace(/[,\s₱$]/g, '');
}

/** Converts "12.5" with 2 decimals into 1250 without going through floating point. */
function toFixedPointInteger(text: string, decimals: number): number {
  const [whole, fraction = ''] = text.split('.');
  return Number(whole) * 10 ** decimals + Number(fraction.padEnd(decimals, '0'));
}

/** Parses an amount like "1,250.50" into centavos. An empty field counts as zero. */
export function parseMoney(input: string, maxCentavos = MAX_UNIT_PRICE_CENTAVOS): ParseResult {
  const text = stripFormatting(input);
  if (text === '') return { isValid: true, value: 0 };
  if (!MONEY_PATTERN.test(text)) return { isValid: false, error: 'Enter an amount like 1250 or 1,250.50' };
  const value = toFixedPointInteger(text, 2);
  if (value > maxCentavos) return { isValid: false, error: `Maximum is ${centavosToPlainText(maxCentavos)}` };
  return { isValid: true, value };
}

/** Parses a quantity like "1.5" into thousandths (1500). Must be greater than zero. */
export function parseQuantity(input: string): ParseResult {
  const text = stripFormatting(input);
  if (text === '') return { isValid: false, error: 'Required' };
  if (!QUANTITY_PATTERN.test(text)) return { isValid: false, error: 'Up to 3 decimal places' };
  const value = toFixedPointInteger(text, 3);
  if (value === 0) return { isValid: false, error: 'Must be more than 0' };
  if (value > MAX_QUANTITY_THOUSANDTHS) return { isValid: false, error: 'Maximum is 99,999.999' };
  return { isValid: true, value };
}

/** Parses a percentage like "12.5" into basis points (1250). An empty field counts as zero. */
export function parsePercent(input: string): ParseResult {
  const text = input.trim().replace(/%$/, '').trim();
  if (text === '') return { isValid: true, value: 0 };
  if (!PERCENT_PATTERN.test(text)) return { isValid: false, error: 'Enter a percentage like 10 or 12.5' };
  const value = toFixedPointInteger(text, 2);
  if (value > MAX_PERCENT_BASIS_POINTS) return { isValid: false, error: 'Maximum is 100%' };
  return { isValid: true, value };
}

/** 125050 → "1250.50", for putting a stored amount back into an input field. */
export function centavosToPlainText(centavos: number): string {
  const whole = Math.floor(centavos / 100);
  const fraction = String(centavos % 100).padStart(2, '0');
  return `${whole}.${fraction}`;
}

/** 1500 → "1.5", 2000 → "2". */
export function quantityToPlainText(thousandths: number): string {
  const whole = Math.floor(thousandths / 1000);
  const fraction = String(thousandths % 1000).padStart(3, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}

/** 1250 basis points → "12.5". */
export function basisPointsToPlainText(basisPoints: number): string {
  const whole = Math.floor(basisPoints / 100);
  const fraction = String(basisPoints % 100).padStart(2, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : String(whole);
}

const currencyFormatters = new Map<CurrencyCode, Intl.NumberFormat>();

/** 125050, PHP → "₱1,250.50". */
export function formatMoney(centavos: number, currency: CurrencyCode): string {
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-PH', { style: 'currency', currency, minimumFractionDigits: 2 });
    currencyFormatters.set(currency, formatter);
  }
  return formatter.format(centavos / 100);
}

const quantityFormatter = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 3 });

export function formatQuantity(thousandths: number): string {
  return quantityFormatter.format(thousandths / 1000);
}

/** PHP → "₱", USD → "$". Used as the prefix inside money inputs. */
export function getCurrencySymbol(currency: CurrencyCode): string {
  const parts = new Intl.NumberFormat('en-PH', { style: 'currency', currency }).formatToParts(0);
  return parts.find((part) => part.type === 'currency')?.value ?? currency;
}
