import { describe, expect, it } from 'vitest';
import { advanceCounters, isAutomaticNumber, suggestNextNumber } from './numbering';

describe('suggestNextNumber', () => {
  it('starts each kind and year at 0001', () => {
    expect(suggestNextNumber({}, 'invoice', 2026)).toBe('INV-2026-0001');
    expect(suggestNextNumber({}, 'acknowledgement_receipt', 2026)).toBe('AR-2026-0001');
  });

  it('continues from the last used number', () => {
    expect(suggestNextNumber({ 'quotation:2026': 41 }, 'quotation', 2026)).toBe('QUO-2026-0042');
  });

  it('restarts in a new year', () => {
    expect(suggestNextNumber({ 'invoice:2026': 99 }, 'invoice', 2027)).toBe('INV-2027-0001');
  });
});

describe('advanceCounters', () => {
  it('moves the counter to the saved number', () => {
    expect(advanceCounters({}, 'invoice', 'INV-2026-0007')).toEqual({ 'invoice:2026': 7 });
  });

  it('never moves backwards when an older number is re-saved', () => {
    const counters = { 'invoice:2026': 10 };
    expect(advanceCounters(counters, 'invoice', 'INV-2026-0003')).toBe(counters);
  });

  it('ignores hand-typed numbers and other kinds’ prefixes', () => {
    const counters = { 'invoice:2026': 2 };
    expect(advanceCounters(counters, 'invoice', 'JOB-17')).toBe(counters);
    expect(advanceCounters(counters, 'invoice', 'QUO-2026-0050')).toBe(counters);
  });
});

describe('isAutomaticNumber', () => {
  it('recognises numbers in the automatic format for that type', () => {
    expect(isAutomaticNumber('invoice', 'INV-2026-0007')).toBe(true);
    expect(isAutomaticNumber('invoice', 'INV-2025-12345')).toBe(true);
  });

  it('rejects typed numbers and other types', () => {
    expect(isAutomaticNumber('invoice', 'JOB-17')).toBe(false);
    expect(isAutomaticNumber('quotation', 'INV-2026-0007')).toBe(false);
  });
});
