import { describe, expect, it } from 'vitest';
import { MAX_QUANTITY_THOUSANDTHS, MAX_UNIT_PRICE_CENTAVOS } from '../money/money';
import { MAX_LINE_ITEMS } from './draft';
import { computeLineAmount, computeTotals, getPaymentStatus } from './totals';
import type { BusinessDocument, LineItem } from './types';

function item(quantityThousandths: number, unitPriceCentavos: number): LineItem {
  return { id: crypto.randomUUID(), description: 'x', quantityThousandths, unit: 'pcs', unitPriceCentavos, priceUnit: null, enteredAmountCentavos: null };
}

type TotalsInput = Pick<BusinessDocument, 'items' | 'discount' | 'otherCharge' | 'amountPaidCentavos'>;

function doc(overrides: Partial<TotalsInput> = {}): TotalsInput {
  return {
    items: [item(2000, 15000), item(1500, 10000)], // 2 × ₱150 + 1.5 × ₱100 = ₱450
    discount: { kind: 'none' },
    otherCharge: { label: 'Delivery fee', centavos: 0 },
    amountPaidCentavos: 0,
    ...overrides,
  };
}

describe('computeLineAmount', () => {
  it('multiplies quantity by unit price', () => {
    expect(computeLineAmount(item(3000, 2550))).toBe(7650);
  });

  it('rounds half a centavo up', () => {
    // 0.5 × ₱0.01 = ₱0.005 → ₱0.01
    expect(computeLineAmount(item(500, 1))).toBe(1);
    // 1.005 × ₱1.00 = ₱1.005 → ₱1.01 (floating point would give 1.00)
    expect(computeLineAmount(item(1005, 100))).toBe(101);
  });

  it('stays exact at the largest allowed values', () => {
    const amount = computeLineAmount(item(MAX_QUANTITY_THOUSANDTHS, MAX_UNIT_PRICE_CENTAVOS));
    expect(Number.isSafeInteger(amount * MAX_LINE_ITEMS)).toBe(true);
  });
});

describe('computeTotals', () => {
  it('adds up line items', () => {
    const totals = computeTotals(doc());
    expect(totals.subtotal).toBe(45000);
    expect(totals.total).toBe(45000);
    expect(totals.balanceDue).toBe(45000);
  });

  it('applies a percent discount and an extra charge', () => {
    const totals = computeTotals(
      doc({ discount: { kind: 'percent', basisPoints: 1000 }, otherCharge: { label: 'Delivery fee', centavos: 5000 } }),
    );
    expect(totals.discount).toBe(4500);
    expect(totals.total).toBe(45000 - 4500 + 5000);
  });

  it('never lets a fixed discount push the total below zero', () => {
    const totals = computeTotals(doc({ discount: { kind: 'fixed', centavos: 999_999 } }));
    expect(totals.discount).toBe(45000);
    expect(totals.total).toBe(0);
  });

  it('subtracts a down payment from the balance and never goes negative', () => {
    expect(computeTotals(doc({ amountPaidCentavos: 20000 })).balanceDue).toBe(25000);
    expect(computeTotals(doc({ amountPaidCentavos: 99999 })).balanceDue).toBe(0);
  });
});

describe('getPaymentStatus', () => {
  it('treats an invoice with nothing to collect as paid', () => {
    expect(getPaymentStatus({ total: 0, amountPaid: 0 })).toBe('paid');
  });

  it.each([
    [0, 'unpaid'],
    [100, 'partial'],
    [45000, 'paid'],
    [50000, 'paid'],
  ] as const)('amount paid %i → %s', (amountPaid, status) => {
    expect(getPaymentStatus({ total: 45000, amountPaid })).toBe(status);
  });
});
