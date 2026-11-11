import { useState, type ChangeEvent } from 'react';
import { CURRENCIES, type CurrencyCode } from '../money/money';
import { TEXT_LIMITS } from '../invoices/draft';
import { BackupFormatError, MAX_BACKUP_FILE_BYTES, parseBackup, parseProfile } from '../storage/backupFormat';
import { createBackup, deleteMyAccount, importBackup } from '../storage/database';
import { FormField } from '../ui/FormField';
import { LogoFileError, readLogoFile } from './logo';
import type { BusinessProfile, PaymentMethod } from './types';

const MAX_PAYMENT_METHODS = 5;

interface SettingsPageProps {
  profile: BusinessProfile;
  onSaveProfile: (profile: BusinessProfile) => Promise<void>;
  /** Called after a backup import so the app reloads its data. */
  onDataImported: () => Promise<void>;
  createId: () => string;
  now: () => Date;
}

type Feedback = { tone: 'success' | 'error'; message: string } | null;

export function SettingsPage({ profile, onSaveProfile, onDataImported, createId, now }: SettingsPageProps) {
  const [form, setForm] = useState<BusinessProfile>(profile);
  const [isSaving, setIsSaving] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<Feedback>(null);
  const [backupFeedback, setBackupFeedback] = useState<Feedback>(null);
  const [isImporting, setIsImporting] = useState(false);

  const update = (changes: Partial<BusinessProfile>) => {
    setProfileFeedback(null);
    setForm((current) => ({ ...current, ...changes }));
  };
  const updateMethod = (id: string, changes: Partial<PaymentMethod>) =>
    update({ paymentMethods: form.paymentMethods.map((method) => (method.id === id ? { ...method, ...changes } : method)) });

  const handleLogoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      update({ logoDataUrl: await readLogoFile(file) });
    } catch (error) {
      setProfileFeedback({
        tone: 'error',
        message: error instanceof LogoFileError ? error.message : 'Could not read that image. Try another file.',
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setProfileFeedback(null);
    try {
      // Same validation as backup import, so a saved profile can always be restored.
      const trimmed = {
        ...form,
        paymentMethods: form.paymentMethods.filter((method) => method.label.trim() || method.details.trim()),
      };
      await onSaveProfile(parseProfile(trimmed));
      setForm(trimmed);
      setProfileFeedback({ tone: 'success', message: 'Business details saved.' });
    } catch (error) {
      const message =
        error instanceof BackupFormatError
          ? error.message.replace('Invalid backup file: ', 'Please check: ')
          : 'Could not save. Please try again.';
      setProfileFeedback({ tone: 'error', message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async () => {
    setBackupFeedback(null);
    try {
      const backup = await createBackup(now());
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-backup-${backup.exportedAt.slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setBackupFeedback({ tone: 'success', message: `Backup downloaded with ${backup.documents.length} document(s).` });
    } catch {
      setBackupFeedback({ tone: 'error', message: 'Could not create the backup. Please try again.' });
    }
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBackupFeedback(null);
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      setBackupFeedback({ tone: 'error', message: 'That file is too large to be a backup from this app.' });
      return;
    }
    setIsImporting(true);
    try {
      const backup = parseBackup(await file.text());
      const summary = await importBackup(backup);
      await onDataImported();
      if (summary.isProfileImported) setForm(backup.profile);
      const parts = [`${summary.added} added`, `${summary.updated} updated`];
      if (summary.skipped > 0) parts.push(`${summary.skipped} skipped because their number is already used here`);
      if (summary.isProfileImported) parts.push('business details restored');
      setBackupFeedback({ tone: 'success', message: `Backup restored: ${parts.join(', ')}.` });
    } catch (error) {
      setBackupFeedback({
        tone: 'error',
        message: error instanceof BackupFormatError ? error.message : 'Could not restore the backup. Please try again.',
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="settings">
      <form
        className="card settings-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave();
        }}
      >
        <h2>Business details</h2>
        <p className="field-hint">Printed on every document.</p>

        <FormField label="Business or your name">
          {(control) => (
            <input {...control} value={form.name} maxLength={TEXT_LIMITS.partyName} onChange={(e) => update({ name: e.target.value })} />
          )}
        </FormField>
        <FormField label="Address">
          {(control) => (
            <textarea {...control} rows={2} value={form.address} maxLength={300} onChange={(e) => update({ address: e.target.value })} />
          )}
        </FormField>
        <div className="grid-2">
          <FormField label="Phone">
            {(control) => (
              <input
                {...control}
                type="tel"
                value={form.phone}
                maxLength={TEXT_LIMITS.partyContact}
                onChange={(e) => update({ phone: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Email">
            {(control) => (
              <input
                {...control}
                type="email"
                value={form.email}
                maxLength={TEXT_LIMITS.partyContact}
                onChange={(e) => update({ email: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="TIN (optional)" hint="Leave blank if you do not have one.">
            {(control) => (
              <input {...control} value={form.tin} maxLength={TEXT_LIMITS.number} onChange={(e) => update({ tin: e.target.value })} />
            )}
          </FormField>
          <FormField label="Default currency">
            {(control) => (
              <select
                {...control}
                value={form.defaultCurrency}
                onChange={(e) => update({ defaultCurrency: e.target.value as CurrencyCode })}
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </div>

        <FormField label="Logo" hint="PNG, JPEG or WebP, up to 300 KB.">
          {(control) => <input {...control} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleLogoChange} />}
        </FormField>
        {form.logoDataUrl && (
          <div className="logo-preview">
            <img src={form.logoDataUrl} alt="Current logo" />
            <button type="button" className="button-quiet" onClick={() => update({ logoDataUrl: null })}>
              Remove logo
            </button>
          </div>
        )}

        <fieldset className="payment-methods">
          <legend>Payment options</legend>
          <p className="field-hint">Shown on invoices and quotations, e.g. GCash, Maya or a bank account.</p>
          {form.paymentMethods.map((method, index) => (
            <div key={method.id} className="payment-method-row">
              <FormField label={`Option ${index + 1} name`}>
                {(control) => (
                  <input
                    {...control}
                    list="payment-labels"
                    value={method.label}
                    maxLength={TEXT_LIMITS.chargeLabel}
                    onChange={(e) => updateMethod(method.id, { label: e.target.value })}
                  />
                )}
              </FormField>
              <FormField label="Account details">
                {(control) => (
                  <input
                    {...control}
                    value={method.details}
                    maxLength={300}
                    onChange={(e) => updateMethod(method.id, { details: e.target.value })}
                  />
                )}
              </FormField>
              <button
                type="button"
                className="button-quiet"
                onClick={() => update({ paymentMethods: form.paymentMethods.filter((other) => other.id !== method.id) })}
              >
                Remove<span className="visually-hidden"> payment option {index + 1}</span>
              </button>
            </div>
          ))}
          <datalist id="payment-labels">
            {['GCash', 'Maya', 'BDO', 'BPI', 'Metrobank', 'UnionBank', 'Landbank', 'Security Bank', 'PayPal'].map((label) => (
              <option key={label} value={label} />
            ))}
          </datalist>
          <button
            type="button"
            className="button-secondary"
            disabled={form.paymentMethods.length >= MAX_PAYMENT_METHODS}
            onClick={() => update({ paymentMethods: [...form.paymentMethods, { id: createId(), label: '', details: '' }] })}
          >
            + Add payment option
          </button>
        </fieldset>

        <FormField label="Default notes for new documents">
          {(control) => (
            <textarea
              {...control}
              rows={2}
              value={form.defaultNotes}
              maxLength={TEXT_LIMITS.notes}
              onChange={(e) => update({ defaultNotes: e.target.value })}
            />
          )}
        </FormField>

        <div className="editor-actions">
          <div role="status" aria-live="polite" className="editor-status">
            {profileFeedback && <p className={`banner banner-${profileFeedback.tone}`}>{profileFeedback.message}</p>}
          </div>
          <button type="submit" className="button-primary" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save business details'}
          </button>
        </div>
      </form>

      <section className="card">
        <h2>Backup</h2>
        <p>
          Your documents are saved to your account. You can also download a copy as a file for your own records, or to
          restore documents from the older offline version of this app.
        </p>
        <div className="backup-actions">
          <button type="button" className="button-secondary" onClick={() => void handleExport()}>
            Download backup
          </button>
          <label className={`button-secondary file-button${isImporting ? ' is-disabled' : ''}`}>
            {isImporting ? 'Restoring…' : 'Restore from backup'}
            <input
              type="file"
              accept="application/json,.json"
              className="visually-hidden"
              disabled={isImporting}
              onChange={handleImport}
            />
          </label>
        </div>
        <p className="field-hint">Restoring adds and updates documents. It never deletes anything.</p>
        <div role="status" aria-live="polite">
          {backupFeedback && <p className={`banner banner-${backupFeedback.tone}`}>{backupFeedback.message}</p>}
        </div>
      </section>

      <DeleteAccountSection />
    </div>
  );
}

const DELETE_CONFIRMATION_WORD = 'DELETE';

/** Permanent erasure of the account and all its data. Requires typing a word so it cannot happen by a stray click. */
function DeleteAccountSection() {
  const [confirmation, setConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isConfirmed = confirmation.trim() === DELETE_CONFIRMATION_WORD;

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteMyAccount();
      // Signing out returns the app to the sign-in page.
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete your account. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <section className="card danger-zone">
      <h2>Delete account</h2>
      <p>
        Permanently deletes your account, business details and <strong>every document</strong>. This cannot be undone.
        Download a backup first if you want to keep a copy.
      </p>
      <FormField label={`Type ${DELETE_CONFIRMATION_WORD} to confirm`} error={error ?? undefined}>
        {(control) => (
          <input {...control} autoComplete="off" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
        )}
      </FormField>
      <div>
        <button type="button" className="button-danger" disabled={!isConfirmed || isDeleting} onClick={() => void handleDelete()}>
          {isDeleting ? 'Deleting…' : 'Delete my account and all documents'}
        </button>
      </div>
    </section>
  );
}
