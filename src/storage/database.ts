/**
 * All app data lives in the browser's IndexedDB. Nothing is sent to a server.
 * This module is the only place that touches IndexedDB, so a cloud-sync
 * backend could replace it later without changing the screens.
 */
import { EMPTY_PROFILE, type BusinessProfile } from '../business/types';
import { advanceCounters, type NumberCounters } from '../invoices/numbering';
import type { BusinessDocument } from '../invoices/types';
import { BACKUP_APP_ID, BACKUP_VERSION, type Backup } from './backupFormat';

const DATABASE_NAME = 'invoice-generator';
const DATABASE_VERSION = 1;
const DOCUMENTS_STORE = 'documents';
const SETTINGS_STORE = 'settings';
const KIND_NUMBER_INDEX = 'kindNumber';
const PROFILE_KEY = 'profile';
const COUNTERS_KEY = 'counters';

export class StorageUnavailableError extends Error {}
export class DuplicateNumberError extends Error {}

export interface AppData {
  profile: BusinessProfile;
  counters: NumberCounters;
  documents: BusinessDocument[];
}

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new StorageUnavailableError('This browser cannot save data. Try a different browser or leave private mode.'));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const documents = database.createObjectStore(DOCUMENTS_STORE, { keyPath: 'id' });
      // Enforces "one INV-2026-0001 per kind" in the database itself, not just in the form.
      documents.createIndex(KIND_NUMBER_INDEX, ['kind', 'number'], { unique: true });
      database.createObjectStore(SETTINGS_STORE);
    };
    request.onsuccess = () => {
      const database = request.result;
      // Another tab is upgrading the schema: close so it is not blocked.
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
    request.onerror = () =>
      reject(new StorageUnavailableError('Could not open saved data. Check that site storage is allowed for this page.'));
  });
  databasePromise.catch(() => {
    databasePromise = null;
  });
  return databasePromise;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('Transaction aborted'));
  });
}

export async function loadAppData(): Promise<AppData> {
  const database = await openDatabase();
  const transaction = database.transaction([DOCUMENTS_STORE, SETTINGS_STORE], 'readonly');
  const [documents, profile, counters] = await Promise.all([
    requestResult(transaction.objectStore(DOCUMENTS_STORE).getAll() as IDBRequest<BusinessDocument[]>),
    requestResult(transaction.objectStore(SETTINGS_STORE).get(PROFILE_KEY) as IDBRequest<BusinessProfile | undefined>),
    requestResult(transaction.objectStore(SETTINGS_STORE).get(COUNTERS_KEY) as IDBRequest<NumberCounters | undefined>),
  ]);
  return { documents, profile: profile ?? EMPTY_PROFILE, counters: counters ?? {} };
}

/**
 * Saves a document and advances the numbering series in one transaction,
 * so two tabs cannot both hand out the same number.
 * Throws DuplicateNumberError if another document of the same kind already uses the number.
 */
export async function saveDocument(doc: BusinessDocument): Promise<NumberCounters> {
  const database = await openDatabase();
  const transaction = database.transaction([DOCUMENTS_STORE, SETTINGS_STORE], 'readwrite');
  const done = transactionDone(transaction);
  const documents = transaction.objectStore(DOCUMENTS_STORE);
  const settings = transaction.objectStore(SETTINGS_STORE);

  const existingId = await requestResult(documents.index(KIND_NUMBER_INDEX).getKey([doc.kind, doc.number]));
  if (existingId !== undefined && existingId !== doc.id) {
    transaction.abort();
    await done.catch(() => undefined);
    throw new DuplicateNumberError(`${doc.number} is already used by another document. Use a different number.`);
  }

  documents.put(doc);
  const counters = (await requestResult(settings.get(COUNTERS_KEY) as IDBRequest<NumberCounters | undefined>)) ?? {};
  const nextCounters = advanceCounters(counters, doc.kind, doc.number);
  if (nextCounters !== counters) settings.put(nextCounters, COUNTERS_KEY);
  await done;
  return nextCounters;
}

export async function deleteDocument(id: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(DOCUMENTS_STORE, 'readwrite');
  transaction.objectStore(DOCUMENTS_STORE).delete(id);
  await transactionDone(transaction);
}

export async function saveProfile(profile: BusinessProfile): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(SETTINGS_STORE, 'readwrite');
  transaction.objectStore(SETTINGS_STORE).put(profile, PROFILE_KEY);
  await transactionDone(transaction);
}

export async function createBackup(now: Date): Promise<Backup> {
  const { profile, counters, documents } = await loadAppData();
  return { app: BACKUP_APP_ID, version: BACKUP_VERSION, exportedAt: now.toISOString(), profile, counters, documents };
}

export interface ImportSummary {
  added: number;
  updated: number;
  /** Documents whose number is already used by a different document here. */
  skipped: number;
  isProfileImported: boolean;
}

/**
 * Merges a backup into the current data without deleting anything:
 * documents with a known id are updated, new ones are added, and number clashes are skipped.
 * The business profile is only taken from the backup when none has been set up here yet.
 */
export async function importBackup(backup: Backup): Promise<ImportSummary> {
  const current = await loadAppData();
  const existingIds = new Set(current.documents.map((doc) => doc.id));
  const numberOwners = new Map(current.documents.map((doc) => [`${doc.kind}\u0000${doc.number}`, doc.id]));

  const summary: ImportSummary = { added: 0, updated: 0, skipped: 0, isProfileImported: false };
  const accepted: BusinessDocument[] = [];
  for (const doc of backup.documents) {
    const numberKey = `${doc.kind}\u0000${doc.number}`;
    const owner = numberOwners.get(numberKey);
    if (owner !== undefined && owner !== doc.id) {
      summary.skipped += 1;
      continue;
    }
    numberOwners.set(numberKey, doc.id);
    accepted.push(doc);
    if (existingIds.has(doc.id)) summary.updated += 1;
    else summary.added += 1;
  }

  const mergedCounters: NumberCounters = { ...current.counters };
  for (const [key, sequence] of Object.entries(backup.counters)) {
    mergedCounters[key] = Math.max(mergedCounters[key] ?? 0, sequence);
  }

  const database = await openDatabase();
  const transaction = database.transaction([DOCUMENTS_STORE, SETTINGS_STORE], 'readwrite');
  const documents = transaction.objectStore(DOCUMENTS_STORE);
  const settings = transaction.objectStore(SETTINGS_STORE);
  for (const doc of accepted) documents.put(doc);
  settings.put(mergedCounters, COUNTERS_KEY);
  if (current.profile.name.trim() === '') {
    settings.put(backup.profile, PROFILE_KEY);
    summary.isProfileImported = true;
  }
  await transactionDone(transaction);
  return summary;
}
