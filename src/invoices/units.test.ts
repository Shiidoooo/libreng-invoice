import { describe, expect, it } from 'vitest';
import { resolvePriceUnit } from './draft';
import { computeLineAmount } from './totals';
import { conversionRatio, priceUnitOptions, toMeasureUnitCode } from './units';

function line(quantityThousandths: number, unit: string, unitPriceCentavos: number, priceUnit: string | null) {
  return computeLineAmount({ quantityThousandths, unit, unitPriceCentavos, priceUnit, enteredAmountCentavos: null });
}

describe('toMeasureUnitCode', () => {
  it.each([
    ['grams', 'g'],
    ['Gramo', 'g'],
    ['kilo', 'kg'],
    ['KG', 'kg'],
    ['liter', 'L'],
    ['ml', 'mL'],
  ])('reads %j as %s', (text, code) => {
    expect(toMeasureUnitCode(text)).toBe(code);
  });

  it('ignores counted units', () => {
    expect(toMeasureUnitCode('pcs')).toBeNull();
    expect(toMeasureUnitCode('pack')).toBeNull();
  });
});

describe('priceUnitOptions', () => {
  it('offers units of the same kind only', () => {
    expect(priceUnitOptions('grams')).toEqual(['g', 'kg']);
    expect(priceUnitOptions('L')).toEqual(['mL', 'L']);
    expect(priceUnitOptions('pcs')).toEqual([]);
  });
});

describe('conversionRatio', () => {
  it('refuses to convert between weight and volume', () => {
    expect(conversionRatio('kg', 'L')).toBeNull();
  });
});

describe('computeLineAmount with a price unit', () => {
  it('prices 500 grams at ₱500 per kilo as ₱250 (the reported bug)', () => {
    expect(line(500_000, 'grams', 50_000, 'kg')).toBe(25_000);
  });

  it('prices 1.5 kg at ₱2 per gram as ₱3,000', () => {
    expect(line(1_500, 'kg', 200, 'g')).toBe(300_000);
  });

  it('prices 750 mL at ₱120 per liter as ₱90', () => {
    expect(line(750_000, 'mL', 12_000, 'L')).toBe(9_000);
  });

  it('rounds to the nearest centavo', () => {
    // 333 g at ₱10/kg = ₱3.33
    expect(line(333_000, 'g', 1_000, 'kg')).toBe(333);
  });

  it('multiplies directly when the price is per the same unit', () => {
    expect(line(3_000, 'pcs', 1_500, null)).toBe(4_500);
  });
});

describe('resolvePriceUnit', () => {
  it('stores nothing when the price is per the same unit', () => {
    expect(resolvePriceUnit('kilos', 'kg')).toBeNull();
    expect(resolvePriceUnit('grams', '')).toBeNull();
  });

  it('keeps a convertible price unit', () => {
    expect(resolvePriceUnit('grams', 'kg')).toBe('kg');
  });

  it('drops a stale price unit after the unit changed to a counted one', () => {
    expect(resolvePriceUnit('pcs', 'kg')).toBeNull();
  });
});
