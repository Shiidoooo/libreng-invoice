import { describe, expect, it } from 'vitest';
import { EMPTY_PROFILE } from '../business/types';
import { convertDraft, createNewDraft } from '../invoices/draft';
import { BACKUP_APP_ID, BACKUP_VERSION, BackupFormatError, parseBackup, type Backup } from './backupFormat';

function validBackup(): Backup {
  let id = 0;
  const draft = createNewDraft({
    kind: 'invoice',
    today: '2026-11-11',
    counters: {},
    profile: EMPTY_PROFILE,
    createId: () => `id-${++id}`,
  });
  draft.items[0] = { ...draft.items[0], description: 'Logo design', quantityText: '1', unitPriceText: '3500' };
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    exportedAt: '2026-11-11T08:00:00.000Z',
    profile: { ...EMPTY_PROFILE, name: 'Aling Nena Store' },
    counters: { 'invoice:2026': 1 },
    documents: [convertDraft(draft, '2026-11-11T08:00:00.000Z').document],
  };
}

describe('parseBackup', () => {
  it('accepts a backup the app itself produced', () => {
    const backup = validBackup();
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup);
  });

  it('rejects text that is not JSON', () => {
    expect(() => parseBackup('not json')).toThrow(BackupFormatError);
  });

  it('rejects files from other apps or versions', () => {
    expect(() => parseBackup(JSON.stringify({ ...validBackup(), app: 'other' }))).toThrow(/not a backup from this app/);
    expect(() => parseBackup(JSON.stringify({ ...validBackup(), version: 99 }))).toThrow(/version 99/);
  });

  it('rejects tampered amounts', () => {
    const backup = validBackup();
    backup.documents[0].items[0].unitPriceCentavos = -100;
    expect(() => parseBackup(JSON.stringify(backup))).toThrow(/unitPriceCentavos/);
  });

  it('rejects a logo that is not a safe image data URL', () => {
    const backup = validBackup();
    backup.profile.logoDataUrl = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
    expect(() => parseBackup(JSON.stringify(backup))).toThrow(/logoDataUrl/);
  });

  it('rejects unknown counter keys', () => {
    const backup = validBackup();
    backup.counters = { '__proto__:2026': 1 };
    expect(() => parseBackup(JSON.stringify(backup))).toThrow(BackupFormatError);
  });
});

describe('parseBackup price units', () => {
  it('reads documents saved before price units existed', () => {
    const backup = validBackup();
    const legacy = JSON.parse(JSON.stringify(backup));
    delete legacy.documents[0].items[0].priceUnit;
    expect(parseBackup(JSON.stringify(legacy)).documents[0].items[0].priceUnit).toBeNull();
  });

  it('rejects a price unit that cannot be converted from the item unit', () => {
    const backup = validBackup();
    backup.documents[0].items[0] = { ...backup.documents[0].items[0], unit: 'pcs', priceUnit: 'kg' };
    expect(() => parseBackup(JSON.stringify(backup))).toThrow(/priceUnit/);
  });
});
