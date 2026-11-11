/**
 * Units that can be converted into each other, so an item sold in grams can be
 * priced per kilo (e.g. 500 g at ₱500/kg = ₱250). Counted units (pcs, pack, hr)
 * are not listed and are never converted.
 */

type Dimension = 'mass' | 'volume';

interface MeasureUnit {
  /** Short label shown in the app and on documents. */
  code: string;
  dimension: Dimension;
  /** Size in the dimension's base unit (grams or millilitres). */
  baseSize: number;
}

const MEASURE_UNITS: MeasureUnit[] = [
  { code: 'g', dimension: 'mass', baseSize: 1 },
  { code: 'kg', dimension: 'mass', baseSize: 1000 },
  { code: 'mL', dimension: 'volume', baseSize: 1 },
  { code: 'L', dimension: 'volume', baseSize: 1000 },
];

/** Everyday spellings, including Filipino ones, mapped to a unit code. Matched case-insensitively. */
const ALIASES: Record<string, string> = {
  g: 'g',
  gm: 'g',
  gms: 'g',
  gr: 'g',
  gram: 'g',
  grams: 'g',
  gramo: 'g',
  kg: 'kg',
  kgs: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  ml: 'mL',
  mls: 'mL',
  milliliter: 'mL',
  milliliters: 'mL',
  millilitre: 'mL',
  millilitres: 'mL',
  l: 'L',
  liter: 'L',
  liters: 'L',
  litre: 'L',
  litres: 'L',
  litro: 'L',
};

function findMeasureUnit(text: string): MeasureUnit | null {
  const code = ALIASES[text.trim().toLowerCase().replace(/\.$/, '')];
  return MEASURE_UNITS.find((unit) => unit.code === code) ?? null;
}

/** "grams" → "g", "Kilo" → "kg"; null for counted units like "pcs". */
export function toMeasureUnitCode(text: string): string | null {
  return findMeasureUnit(text)?.code ?? null;
}

/** Units the price can be quoted per, for an item measured in `quantityUnit`. Empty for counted units. */
export function priceUnitOptions(quantityUnit: string): string[] {
  const unit = findMeasureUnit(quantityUnit);
  if (!unit) return [];
  return MEASURE_UNITS.filter((other) => other.dimension === unit.dimension).map((other) => other.code);
}

export interface UnitRatio {
  numerator: number;
  denominator: number;
}

/**
 * How many price units one quantity unit is, as an exact ratio.
 * 1 g priced per kg → 1/1000. Returns null when the units cannot be converted.
 */
export function conversionRatio(quantityUnit: string, priceUnit: string): UnitRatio | null {
  const from = findMeasureUnit(quantityUnit);
  const to = findMeasureUnit(priceUnit);
  if (!from || !to || from.dimension !== to.dimension) return null;
  return { numerator: from.baseSize, denominator: to.baseSize };
}
