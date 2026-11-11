import { DOCUMENT_KIND_CONFIG } from './documentKinds';
import type { DocumentKind } from './types';

/** Last used sequence per kind and year, keyed as "invoice:2026". A new year starts again at 0001. */
export type NumberCounters = Record<string, number>;

const SEQUENCE_DIGITS = 4;

function counterKey(kind: DocumentKind, year: number): string {
  return `${kind}:${year}`;
}

export function formatDocumentNumber(kind: DocumentKind, year: number, sequence: number): string {
  const prefix = DOCUMENT_KIND_CONFIG[kind].numberPrefix;
  return `${prefix}-${year}-${String(sequence).padStart(SEQUENCE_DIGITS, '0')}`;
}

export function suggestNextNumber(counters: NumberCounters, kind: DocumentKind, year: number): string {
  return formatDocumentNumber(kind, year, (counters[counterKey(kind, year)] ?? 0) + 1);
}

/**
 * Returns the counters updated after a document is saved with `documentNumber`.
 * Only numbers in the automatic format move the counter, and never backwards,
 * so a hand-typed number like "JOB-17" leaves the series alone.
 */
export function advanceCounters(counters: NumberCounters, kind: DocumentKind, documentNumber: string): NumberCounters {
  const prefix = DOCUMENT_KIND_CONFIG[kind].numberPrefix;
  const match = new RegExp(`^${prefix}-(\\d{4})-(\\d{${SEQUENCE_DIGITS},})$`).exec(documentNumber);
  if (!match) return counters;
  const key = counterKey(kind, Number(match[1]));
  const sequence = Number(match[2]);
  if (sequence <= (counters[key] ?? 0)) return counters;
  return { ...counters, [key]: sequence };
}
