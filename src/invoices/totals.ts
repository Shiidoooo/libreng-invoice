import type { BusinessDocument, Discount, LineItem } from './types';

export interface DocumentTotals {
  lineAmounts: number[];
  subtotal: number;
  discount: number;
  otherCharge: number;
  total: number;
  amountPaid: number;
  balanceDue: number;
}

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

/** Divides a non-negative bigint, rounding half up. */
function divideRoundHalfUp(numerator: bigint, divisor: bigint): number {
  return Number((numerator + divisor / 2n) / divisor);
}

/** quantity × unit price, rounded to the nearest centavo. BigInt keeps the intermediate product exact. */
export function computeLineAmount(item: Pick<LineItem, 'quantityThousandths' | 'unitPriceCentavos'>): number {
  return divideRoundHalfUp(BigInt(item.quantityThousandths) * BigInt(item.unitPriceCentavos), 1000n);
}

/** A discount never exceeds the subtotal, so the total cannot go negative. */
export function computeDiscount(discount: Discount, subtotal: number): number {
  switch (discount.kind) {
    case 'none':
      return 0;
    case 'percent':
      return divideRoundHalfUp(BigInt(subtotal) * BigInt(discount.basisPoints), 10_000n);
    case 'fixed':
      return Math.min(discount.centavos, subtotal);
  }
}

export function computeTotals(
  doc: Pick<BusinessDocument, 'items' | 'discount' | 'otherCharge' | 'amountPaidCentavos'>,
): DocumentTotals {
  const lineAmounts = doc.items.map(computeLineAmount);
  const subtotal = lineAmounts.reduce((sum, amount) => sum + amount, 0);
  const discount = computeDiscount(doc.discount, subtotal);
  const otherCharge = doc.otherCharge.centavos;
  const total = subtotal - discount + otherCharge;
  const amountPaid = doc.amountPaidCentavos;
  return {
    lineAmounts,
    subtotal,
    discount,
    otherCharge,
    total,
    amountPaid,
    balanceDue: Math.max(total - amountPaid, 0),
  };
}

export function getPaymentStatus(totals: Pick<DocumentTotals, 'total' | 'amountPaid'>): PaymentStatus {
  if (totals.amountPaid <= 0) return 'unpaid';
  if (totals.amountPaid >= totals.total) return 'paid';
  return 'partial';
}
