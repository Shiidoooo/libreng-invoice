import { describe, expect, it } from 'vitest';
import { EMPTY_PROFILE } from '../business/types';
import { convertDraft, createNewDraft, draftFromDocument, duplicateAsDraft, type DocumentDraft } from './draft';

const NOW = '2026-11-11T08:00:00.000Z';
let idCounter = 0;
const createId = () => `id-${++idCounter}`;

function newDraft(overrides: Partial<DocumentDraft> = {}): DocumentDraft {
  const draft = createNewDraft({ kind: 'invoice', today: '2026-11-11', counters: {}, profile: EMPTY_PROFILE, createId });
  return {
    ...draft,
    items: [{ ...draft.items[0], description: 'Lucky Me Pancit Canton', quantityText: '12', unitPriceText: '15.50' }],
    ...overrides,
  };
}

describe('createNewDraft', () => {
  it('suggests the next number and a due date 15 days out', () => {
    const draft = newDraft();
    expect(draft.number).toBe('INV-2026-0001');
    expect(draft.dueDate).toBe('2026-11-26');
    expect(draft.currency).toBe('PHP');
  });

  it('has no due date for receipts', () => {
    const draft = createNewDraft({
      kind: 'acknowledgement_receipt',
      today: '2026-11-11',
      counters: {},
      profile: EMPTY_PROFILE,
      createId,
    });
    expect(draft.dueDate).toBe('');
  });
});

describe('convertDraft', () => {
  it('converts a valid draft into a document', () => {
    const { document, isValid } = convertDraft(newDraft({ amountPaidText: '100' }), NOW);
    expect(isValid).toBe(true);
    expect(document.items[0]).toMatchObject({ quantityThousandths: 12000, unitPriceCentavos: 1550 });
    expect(document.amountPaidCentavos).toBe(10000);
    expect(document.createdAt).toBe(NOW);
  });

  it('reports field errors but still produces a previewable document', () => {
    const draft = newDraft({ number: '  ', amountPaidText: 'abc' });
    const itemId = draft.items[0].id;
    draft.items[0] = { ...draft.items[0], description: '', quantityText: '0' };

    const { document, errors, isValid } = convertDraft(draft, NOW);

    expect(isValid).toBe(false);
    expect(errors.number).toBe('Required');
    expect(errors.amountPaid).toBeDefined();
    expect(errors[`items.${itemId}.description`]).toBe('Required');
    expect(errors[`items.${itemId}.quantity`]).toBeDefined();
    expect(document.amountPaidCentavos).toBe(0);
  });

  it('rejects an impossible date', () => {
    expect(convertDraft(newDraft({ issueDate: '2026-02-30' }), NOW).errors.issueDate).toBeDefined();
  });

  it('ignores payment and due date for a delivery receipt', () => {
    const { document, isValid } = convertDraft(
      newDraft({ kind: 'delivery_receipt', amountPaidText: 'not a number', dueDate: '2026-12-01' }),
      NOW,
    );
    expect(isValid).toBe(true);
    expect(document.amountPaidCentavos).toBe(0);
    expect(document.dueDate).toBeNull();
  });

  it('round-trips through draftFromDocument without changing values', () => {
    const first = convertDraft(newDraft({ discountKind: 'percent', discountText: '12.5' }), NOW).document;
    const second = convertDraft(draftFromDocument(first), NOW).document;
    expect(second).toEqual(first);
  });
});

describe('duplicateAsDraft', () => {
  it('copies items with new ids, a new number and no payment', () => {
    const original = convertDraft(newDraft({ amountPaidText: '50' }), NOW).document;
    const copy = duplicateAsDraft(original, { today: '2026-12-01', counters: { 'invoice:2026': 1 }, createId });
    expect(copy.id).not.toBe(original.id);
    expect(copy.number).toBe('INV-2026-0002');
    expect(copy.issueDate).toBe('2026-12-01');
    expect(copy.amountPaidText).toBe('');
    expect(copy.items[0].id).not.toBe(original.items[0].id);
    expect(copy.items[0].description).toBe(original.items[0].description);
  });
});
