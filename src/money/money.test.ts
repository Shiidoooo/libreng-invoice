import { describe, expect, it } from 'vitest';
import {
  MAX_UNIT_PRICE_CENTAVOS,
  basisPointsToPlainText,
  centavosToPlainText,
  formatMoney,
  getCurrencySymbol,
  parseMoney,
  parsePercent,
  parseQuantity,
  quantityToPlainText,
} from './money';

describe('parseMoney', () => {
  it.each([
    ['1250', 125000],
    ['1,250.50', 125050],
    ['₱ 1,250.5', 125050],
    ['0.01', 1],
    ['', 0],
  ])('parses %j as %i centavos', (input, expected) => {
    expect(parseMoney(input)).toEqual({ isValid: true, value: expected });
  });

  it.each(['abc', '12.345', '-5', '1.2.3', '1e5'])('rejects %j', (input) => {
    expect(parseMoney(input).isValid).toBe(false);
  });

  it('accepts the maximum and rejects one centavo more', () => {
    expect(parseMoney('9999999.99')).toEqual({ isValid: true, value: MAX_UNIT_PRICE_CENTAVOS });
    expect(parseMoney('10000000.00').isValid).toBe(false);
  });

  it('does not drift like floating point (0.1 + 0.2 case)', () => {
    const a = parseMoney('0.10');
    const b = parseMoney('0.20');
    expect(a.isValid && b.isValid && a.value + b.value).toBe(30);
  });
});

describe('parseQuantity', () => {
  it('parses decimals into thousandths', () => {
    expect(parseQuantity('1.5')).toEqual({ isValid: true, value: 1500 });
    expect(parseQuantity('0.125')).toEqual({ isValid: true, value: 125 });
  });

  it.each(['', '0', '0.000', '1.2345', '100000'])('rejects %j', (input) => {
    expect(parseQuantity(input).isValid).toBe(false);
  });
});

describe('parsePercent', () => {
  it('parses into basis points', () => {
    expect(parsePercent('12.5')).toEqual({ isValid: true, value: 1250 });
    expect(parsePercent('10%')).toEqual({ isValid: true, value: 1000 });
    expect(parsePercent('100')).toEqual({ isValid: true, value: 10000 });
  });

  it('rejects more than 100%', () => {
    expect(parsePercent('100.01').isValid).toBe(false);
  });
});

describe('round-tripping to input text', () => {
  it('converts stored values back to editable text', () => {
    expect(centavosToPlainText(125005)).toBe('1250.05');
    expect(quantityToPlainText(1500)).toBe('1.5');
    expect(quantityToPlainText(2000)).toBe('2');
    expect(basisPointsToPlainText(1250)).toBe('12.5');
  });
});

describe('formatMoney', () => {
  it('formats pesos with the peso sign and separators', () => {
    expect(formatMoney(125050, 'PHP')).toBe('₱1,250.50');
  });
});

describe('getCurrencySymbol', () => {
  it('returns the symbol shown before amounts', () => {
    expect(getCurrencySymbol('PHP')).toBe('₱');
  });
});
