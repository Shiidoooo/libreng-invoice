import { describe, expect, it } from 'vitest';
import { EMPTY_PROFILE } from '../business/types';
import { createNewDraft } from './draft';
import { isDocumentDraft } from './draftStorage';

let id = 0;
const draft = () => createNewDraft({ kind: 'invoice', today: '2026-11-11', counters: {}, profile: EMPTY_PROFILE, createId: () => `id-${++id}` });

describe('isDocumentDraft', () => {
  it('accepts a real draft after a JSON round trip', () => {
    expect(isDocumentDraft(JSON.parse(JSON.stringify(draft())))).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'draft'],
    ['an unknown type', { ...draft(), kind: 'payslip' }],
    ['no items', { ...draft(), items: [] }],
    ['a damaged item', { ...draft(), items: [{ id: 'x' }] }],
  ])('rejects %s', (_label, value) => {
    expect(isDocumentDraft(value)).toBe(false);
  });
});
