/**
 * All reads and writes to the cloud database (Supabase Postgres).
 * Row Level Security in supabase/migrations limits every query to the signed-in
 * user's own rows; this module adds no authorization of its own.
 * Rows are validated on the way in, because the database only checks their outline.
 */
import type { PostgrestError } from '@supabase/supabase-js';
import { EMPTY_PROFILE, type BusinessProfile } from '../business/types';
import type { NumberCounters } from '../invoices/numbering';
import type { BusinessDocument } from '../invoices/types';
import { BACKUP_APP_ID, BACKUP_VERSION, parseDocument, parseProfile, type Backup } from './backupFormat';
import { requireSupabase } from './supabaseClient';

const PAGE_SIZE = 1000;
/** Upper bound on documents loaded at once, so a huge account cannot freeze the tab. */
const MAX_DOCUMENTS = 20_000;
const IMPORT_BATCH_SIZE = 200;
const UNIQUE_VIOLATION = '23505';

const DOCUMENT_COLUMNS =
  'id, kind, number, issue_date, due_date, customer, items, discount, other_charge, amount_paid_centavos, currency, notes, show_not_official_receipt_notice, created_at, updated_at';
const PROFILE_COLUMNS =
  'name, address, phone, email, tin, logo_data_url, payment_methods, default_currency, default_notes';

/** An error whose message is safe and useful to show the user. */
export class StorageError extends Error {}
export class DuplicateNumberError extends StorageError {}

export interface AppData {
  profile: BusinessProfile;
  counters: NumberCounters;
  documents: BusinessDocument[];
  /** Saved rows that failed validation and were left out. */
  skippedDocumentCount: number;
}

interface DocumentRow {
  id: string;
  kind: string;
  number: string;
  issue_date: string;
  due_date: string | null;
  customer: unknown;
  items: unknown;
  discount: unknown;
  other_charge: unknown;
  amount_paid_centavos: number;
  currency: string;
  notes: string;
  show_not_official_receipt_notice: boolean;
  created_at: string;
  updated_at: string;
}

interface ProfileRow {
  name: string;
  address: string;
  phone: string;
  email: string;
  tin: string;
  logo_data_url: string | null;
  payment_methods: unknown;
  default_currency: string;
  default_notes: string;
}

function toStorageError(error: PostgrestError | Error, action: string): StorageError {
  // Full details go to the developer console only; the user gets a plain message.
  console.error(`Database error while trying to ${action}`, error);
  if ('code' in error && error.code === UNIQUE_VIOLATION) {
    return new DuplicateNumberError('That number is already used by another document of the same type. Use a different number.');
  }
  if (error.name === 'AbortError' || error.name === 'TimeoutError' || error.message.includes('Failed to fetch')) {
    return new StorageError(`Could not ${action}: the server did not respond. Check your internet connection and try again.`);
  }
  return new StorageError(`Could not ${action}. Please try again.`);
}

function rowToDocument(row: DocumentRow): BusinessDocument {
  return parseDocument(
    {
      id: row.id,
      kind: row.kind,
      number: row.number,
      issueDate: row.issue_date,
      dueDate: row.due_date,
      customer: row.customer,
      items: row.items,
      discount: row.discount,
      otherCharge: row.other_charge,
      amountPaidCentavos: row.amount_paid_centavos,
      currency: row.currency,
      notes: row.notes,
      showNotOfficialReceiptNotice: row.show_not_official_receipt_notice,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
    `document ${row.id}`,
  );
}

/** updated_at is set by the database; user_id defaults to the signed-in user. */
function documentToRow(doc: BusinessDocument): Omit<DocumentRow, 'updated_at'> {
  return {
    id: doc.id,
    kind: doc.kind,
    number: doc.number,
    issue_date: doc.issueDate,
    due_date: doc.dueDate,
    customer: doc.customer,
    items: doc.items,
    discount: doc.discount,
    other_charge: doc.otherCharge,
    amount_paid_centavos: doc.amountPaidCentavos,
    currency: doc.currency,
    notes: doc.notes,
    show_not_official_receipt_notice: doc.showNotOfficialReceiptNotice,
    created_at: doc.createdAt,
  };
}

function rowToProfile(row: ProfileRow): BusinessProfile {
  return parseProfile({
    name: row.name,
    address: row.address,
    phone: row.phone,
    email: row.email,
    tin: row.tin,
    logoDataUrl: row.logo_data_url,
    paymentMethods: row.payment_methods,
    defaultCurrency: row.default_currency,
    defaultNotes: row.default_notes,
  });
}

async function fetchDocuments(): Promise<{ documents: BusinessDocument[]; skipped: number }> {
  const client = requireSupabase();
  const documents: BusinessDocument[] = [];
  let skipped = 0;
  for (let from = 0; from < MAX_DOCUMENTS; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('documents')
      .select(DOCUMENT_COLUMNS)
      .order('updated_at', { ascending: false })
      .order('id')
      .range(from, from + PAGE_SIZE - 1)
      .returns<DocumentRow[]>();
    if (error) throw toStorageError(error, 'load your documents');
    for (const row of data) {
      try {
        documents.push(rowToDocument(row));
      } catch (validationError) {
        skipped += 1;
        console.warn(`Skipped invalid document ${row.id}`, validationError);
      }
    }
    if (data.length < PAGE_SIZE) break;
  }
  return { documents, skipped };
}

async function fetchCounters(): Promise<NumberCounters> {
  const { data, error } = await requireSupabase()
    .from('document_counters')
    .select('kind, year, last_sequence')
    .returns<{ kind: string; year: number; last_sequence: number }[]>();
  if (error) throw toStorageError(error, 'load your numbering');
  return Object.fromEntries(data.map((row) => [`${row.kind}:${row.year}`, row.last_sequence]));
}

async function fetchProfile(): Promise<BusinessProfile> {
  const { data, error } = await requireSupabase()
    .from('business_profiles')
    .select(PROFILE_COLUMNS)
    .maybeSingle<ProfileRow>();
  if (error) throw toStorageError(error, 'load your business details');
  if (!data) return EMPTY_PROFILE;
  try {
    return rowToProfile(data);
  } catch (validationError) {
    console.warn('Saved business profile is invalid; starting from an empty one', validationError);
    return EMPTY_PROFILE;
  }
}

export async function loadAppData(): Promise<AppData> {
  const [profile, counters, { documents, skipped }] = await Promise.all([fetchProfile(), fetchCounters(), fetchDocuments()]);
  return { profile, counters, documents, skippedDocumentCount: skipped };
}

/**
 * Inserts or updates a document. The database advances the numbering counter
 * in the same transaction and rejects a number already used for the same type.
 * Returns the saved document (with the server's timestamps) and fresh counters.
 */
export async function saveDocument(doc: BusinessDocument): Promise<{ document: BusinessDocument; counters: NumberCounters }> {
  const { data, error } = await requireSupabase()
    .from('documents')
    .upsert(documentToRow(doc), { onConflict: 'id' })
    .select(DOCUMENT_COLUMNS)
    .single<DocumentRow>();
  if (error) throw toStorageError(error, `save ${doc.number}`);
  return { document: rowToDocument(data), counters: await fetchCounters() };
}

export async function deleteDocument(doc: BusinessDocument): Promise<void> {
  const { data, error } = await requireSupabase().from('documents').delete().eq('id', doc.id).select('id');
  if (error) throw toStorageError(error, `delete ${doc.number}`);
  if (data.length === 0) throw new StorageError(`${doc.number} was not found. It may already be deleted; refresh the page.`);
}

async function currentUserId(): Promise<string> {
  const { data } = await requireSupabase().auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) throw new StorageError('You are signed out. Sign in again to save.');
  return userId;
}

export async function saveProfile(profile: BusinessProfile): Promise<void> {
  const row: ProfileRow & { user_id: string } = {
    user_id: await currentUserId(),
    name: profile.name,
    address: profile.address,
    phone: profile.phone,
    email: profile.email,
    tin: profile.tin,
    logo_data_url: profile.logoDataUrl,
    payment_methods: profile.paymentMethods,
    default_currency: profile.defaultCurrency,
    default_notes: profile.defaultNotes,
  };
  const { error } = await requireSupabase().from('business_profiles').upsert(row, { onConflict: 'user_id' });
  if (error) throw toStorageError(error, 'save your business details');
}

export async function createBackup(now: Date): Promise<Backup> {
  const { profile, counters, documents } = await loadAppData();
  return { app: BACKUP_APP_ID, version: BACKUP_VERSION, exportedAt: now.toISOString(), profile, counters, documents };
}

export interface ImportSummary {
  added: number;
  updated: number;
  /** Documents whose number is already used by a different document in this account. */
  skipped: number;
  isProfileImported: boolean;
}

/**
 * Merges a backup into the account without deleting anything: known ids are
 * updated, new ones added, number clashes skipped. The business profile is only
 * taken from the backup when none has been set up yet. Counters follow
 * automatically through the database trigger.
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

  const client = requireSupabase();
  for (let i = 0; i < accepted.length; i += IMPORT_BATCH_SIZE) {
    const batch = accepted.slice(i, i + IMPORT_BATCH_SIZE).map(documentToRow);
    const { error } = await client.from('documents').upsert(batch, { onConflict: 'id' });
    if (error) throw toStorageError(error, 'restore the backup (part of it may already be restored; restoring again is safe)');
  }

  if (current.profile.name.trim() === '') {
    await saveProfile(backup.profile);
    summary.isProfileImported = true;
  }
  return summary;
}

/** Permanently deletes the account and every document, profile and counter in it. */
export async function deleteMyAccount(): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.rpc('delete_my_account');
  if (error) throw toStorageError(error, 'delete your account');
  await client.auth.signOut({ scope: 'local' });
}
