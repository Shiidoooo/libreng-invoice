import { useMemo, useState } from 'react';
import type { BusinessProfile } from '../business/types';
import { addDays } from '../dates/dates';
import { CURRENCIES, formatMoney, type CurrencyCode } from '../money/money';
import { FormField } from '../ui/FormField';
import { DOCUMENT_KIND_CONFIG } from './documentKinds';
import { DocumentPreview } from './DocumentPreview';
import { printDocument } from './printDocument';
import {
  DEFAULT_DUE_IN_DAYS,
  MAX_LINE_ITEMS,
  TEXT_LIMITS,
  convertDraft,
  createEmptyLineItem,
  type DocumentDraft,
  type LineItemDraft,
} from './draft';
import { suggestNextNumber, type NumberCounters } from './numbering';
import { computeTotals } from './totals';
import { DOCUMENT_KINDS, type BusinessDocument, type Discount, type DocumentKind, type Party } from './types';

interface DocumentEditorProps {
  draft: DocumentDraft;
  profile: BusinessProfile;
  counters: NumberCounters;
  pastCustomers: Party[];
  onDraftChange: (draft: DocumentDraft) => void;
  /** Persists the document. Rejects with a user-facing message on failure. */
  onSave: (document: BusinessDocument) => Promise<void>;
  createId: () => string;
  now: () => Date;
}

type PaneOnMobile = 'form' | 'preview';

export function DocumentEditor({
  draft,
  profile,
  counters,
  pastCustomers,
  onDraftChange,
  onSave,
  createId,
  now,
}: DocumentEditorProps) {
  const [hasTriedSave, setHasTriedSave] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [paneOnMobile, setPaneOnMobile] = useState<PaneOnMobile>('form');

  const config = DOCUMENT_KIND_CONFIG[draft.kind];
  const conversion = useMemo(() => convertDraft(draft, now().toISOString()), [draft, now]);
  const totals = computeTotals(conversion.document);
  const visibleErrors = hasTriedSave ? conversion.errors : {};

  const update = (changes: Partial<DocumentDraft>) => {
    setSaveMessage(null);
    onDraftChange({ ...draft, ...changes });
  };
  const updateCustomer = (changes: Partial<Party>) => update({ customer: { ...draft.customer, ...changes } });
  const updateItem = (id: string, changes: Partial<LineItemDraft>) =>
    update({ items: draft.items.map((item) => (item.id === id ? { ...item, ...changes } : item)) });

  const handleKindChange = (kind: DocumentKind) => {
    const year = Number(draft.issueDate.slice(0, 4));
    // Swap the suggested number only if the user has not typed their own.
    const isAutoNumber = draft.isNew && draft.number === suggestNextNumber(counters, draft.kind, year);
    const hasDueDate = DOCUMENT_KIND_CONFIG[kind].dueDateLabel !== null;
    update({
      kind,
      number: isAutoNumber ? suggestNextNumber(counters, kind, year) : draft.number,
      dueDate: hasDueDate ? draft.dueDate || addDays(draft.issueDate, DEFAULT_DUE_IN_DAYS) : '',
    });
  };

  const handleCustomerNameChange = (name: string) => {
    const known = pastCustomers.find((customer) => customer.name === name);
    if (known && !draft.customer.address && !draft.customer.contact) {
      updateCustomer({ ...known });
    } else {
      updateCustomer({ name });
    }
  };

  const handleSave = async ({ shouldPrint }: { shouldPrint: boolean }) => {
    setHasTriedSave(true);
    setSaveError(null);
    setSaveMessage(null);
    if (!conversion.isValid) {
      setSaveError('Some fields need fixing. They are marked below.');
      return;
    }
    setIsSaving(true);
    try {
      await onSave(conversion.document);
      setSaveMessage(`${config.title} ${conversion.document.number} saved.`);
      if (shouldPrint) printDocument(conversion.document.number);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="editor" data-pane={paneOnMobile}>
      <div className="pane-switch" role="group" aria-label="Show">
        <button type="button" aria-pressed={paneOnMobile === 'form'} onClick={() => setPaneOnMobile('form')}>
          Edit
        </button>
        <button type="button" aria-pressed={paneOnMobile === 'preview'} onClick={() => setPaneOnMobile('preview')}>
          Preview
        </button>
      </div>

      <form
        className="editor-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleSave({ shouldPrint: false });
        }}
      >
        <fieldset className="card">
          <legend>Document</legend>
          <div className="grid-2">
            <FormField label="Type">
              {(control) => (
                <select {...control} value={draft.kind} onChange={(e) => handleKindChange(e.target.value as DocumentKind)}>
                  {DOCUMENT_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {DOCUMENT_KIND_CONFIG[kind].title}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField label="Number" isRequired error={visibleErrors.number}>
              {(control) => (
                <input
                  {...control}
                  value={draft.number}
                  maxLength={TEXT_LIMITS.number}
                  onChange={(e) => update({ number: e.target.value })}
                />
              )}
            </FormField>
            <FormField label="Date" isRequired error={visibleErrors.issueDate}>
              {(control) => (
                <input {...control} type="date" value={draft.issueDate} onChange={(e) => update({ issueDate: e.target.value })} />
              )}
            </FormField>
            {config.dueDateLabel && (
              <FormField label={config.dueDateLabel} error={visibleErrors.dueDate}>
                {(control) => (
                  <input {...control} type="date" value={draft.dueDate} onChange={(e) => update({ dueDate: e.target.value })} />
                )}
              </FormField>
            )}
            <FormField label="Currency">
              {(control) => (
                <select {...control} value={draft.currency} onChange={(e) => update({ currency: e.target.value as CurrencyCode })}>
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          </div>
        </fieldset>

        <fieldset className="card">
          <legend>{config.customerLabel}</legend>
          <FormField label="Name" error={visibleErrors['customer.name']} hint="Past customers fill in automatically.">
            {(control) => (
              <input
                {...control}
                list="past-customers"
                autoComplete="off"
                value={draft.customer.name}
                maxLength={TEXT_LIMITS.partyName}
                onChange={(e) => handleCustomerNameChange(e.target.value)}
              />
            )}
          </FormField>
          <datalist id="past-customers">
            {pastCustomers.map((customer) => (
              <option key={customer.name} value={customer.name} />
            ))}
          </datalist>
          <FormField label="Address" error={visibleErrors['customer.address']}>
            {(control) => (
              <textarea
                {...control}
                rows={2}
                value={draft.customer.address}
                maxLength={TEXT_LIMITS.partyAddress}
                onChange={(e) => updateCustomer({ address: e.target.value })}
              />
            )}
          </FormField>
          <FormField label="Contact (phone or email)" error={visibleErrors['customer.contact']}>
            {(control) => (
              <input
                {...control}
                value={draft.customer.contact}
                maxLength={TEXT_LIMITS.partyContact}
                onChange={(e) => updateCustomer({ contact: e.target.value })}
              />
            )}
          </FormField>
        </fieldset>

        <fieldset className="card">
          <legend>Items</legend>
          {visibleErrors.items && <p className="field-error">{visibleErrors.items}</p>}
          <ol className="items">
            {draft.items.map((item, index) => {
              const prefix = `items.${item.id}`;
              return (
                <li key={item.id} className="item-row">
                  <FormField
                    className="item-description"
                    label={`Item ${index + 1} description`}
                    isRequired
                    error={visibleErrors[`${prefix}.description`]}
                  >
                    {(control) => (
                      <input
                        {...control}
                        value={item.description}
                        maxLength={TEXT_LIMITS.itemDescription}
                        onChange={(e) => updateItem(item.id, { description: e.target.value })}
                      />
                    )}
                  </FormField>
                  <FormField label="Qty" isRequired error={visibleErrors[`${prefix}.quantity`]}>
                    {(control) => (
                      <input
                        {...control}
                        inputMode="decimal"
                        value={item.quantityText}
                        onChange={(e) => updateItem(item.id, { quantityText: e.target.value })}
                      />
                    )}
                  </FormField>
                  <FormField label="Unit" error={visibleErrors[`${prefix}.unit`]}>
                    {(control) => (
                      <input
                        {...control}
                        list="common-units"
                        value={item.unit}
                        maxLength={TEXT_LIMITS.itemUnit}
                        onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                      />
                    )}
                  </FormField>
                  <FormField label="Unit price" error={visibleErrors[`${prefix}.unitPrice`]}>
                    {(control) => (
                      <input
                        {...control}
                        inputMode="decimal"
                        placeholder="0.00"
                        value={item.unitPriceText}
                        onChange={(e) => updateItem(item.id, { unitPriceText: e.target.value })}
                      />
                    )}
                  </FormField>
                  <p className="item-amount" aria-live="polite">
                    <span className="field-label">Amount</span>
                    {formatMoney(totals.lineAmounts[index] ?? 0, draft.currency)}
                  </p>
                  <button
                    type="button"
                    className="button-quiet item-remove"
                    disabled={draft.items.length === 1}
                    onClick={() => update({ items: draft.items.filter((other) => other.id !== item.id) })}
                  >
                    Remove<span className="visually-hidden"> item {index + 1}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <datalist id="common-units">
            {['pcs', 'pack', 'box', 'kg', 'g', 'L', 'mL', 'dozen', 'set', 'hr', 'day', 'session', 'lot'].map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>
          <button
            type="button"
            className="button-secondary"
            disabled={draft.items.length >= MAX_LINE_ITEMS}
            onClick={() => update({ items: [...draft.items, createEmptyLineItem(createId())] })}
          >
            + Add item
          </button>
        </fieldset>

        <fieldset className="card">
          <legend>Adjustments</legend>
          <div className="grid-2">
            <FormField label="Discount">
              {(control) => (
                <select
                  {...control}
                  value={draft.discountKind}
                  onChange={(e) => update({ discountKind: e.target.value as Discount['kind'], discountText: '' })}
                >
                  <option value="none">No discount</option>
                  <option value="percent">Percent (%)</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              )}
            </FormField>
            {draft.discountKind !== 'none' && (
              <FormField
                label={draft.discountKind === 'percent' ? 'Discount %' : 'Discount amount'}
                error={visibleErrors.discount}
              >
                {(control) => (
                  <input
                    {...control}
                    inputMode="decimal"
                    value={draft.discountText}
                    onChange={(e) => update({ discountText: e.target.value })}
                  />
                )}
              </FormField>
            )}
            <FormField label="Extra charge label" error={visibleErrors.otherChargeLabel} hint="e.g. Delivery fee, Rush fee">
              {(control) => (
                <input
                  {...control}
                  value={draft.otherChargeLabel}
                  maxLength={TEXT_LIMITS.chargeLabel}
                  onChange={(e) => update({ otherChargeLabel: e.target.value })}
                />
              )}
            </FormField>
            <FormField label="Extra charge amount" error={visibleErrors.otherCharge}>
              {(control) => (
                <input
                  {...control}
                  inputMode="decimal"
                  placeholder="0.00"
                  value={draft.otherChargeText}
                  onChange={(e) => update({ otherChargeText: e.target.value })}
                />
              )}
            </FormField>
            {config.amountPaidLabel && (
              <FormField
                label={config.amountPaidLabel}
                error={visibleErrors.amountPaid}
                hint={draft.kind === 'invoice' ? 'Down payment or partial payment received.' : undefined}
              >
                {(control) => (
                  <input
                    {...control}
                    inputMode="decimal"
                    placeholder="0.00"
                    value={draft.amountPaidText}
                    onChange={(e) => update({ amountPaidText: e.target.value })}
                  />
                )}
              </FormField>
            )}
          </div>
          <p className="editor-total" aria-live="polite">
            Total: <strong>{formatMoney(totals.total, draft.currency)}</strong>
            {config.amountPaidLabel && totals.amountPaid > 0 && (
              <> · Balance due: <strong>{formatMoney(totals.balanceDue, draft.currency)}</strong></>
            )}
          </p>
        </fieldset>

        <fieldset className="card">
          <legend>Notes</legend>
          <FormField label="Notes or terms" error={visibleErrors.notes}>
            {(control) => (
              <textarea
                {...control}
                rows={3}
                value={draft.notes}
                maxLength={TEXT_LIMITS.notes}
                onChange={(e) => update({ notes: e.target.value })}
              />
            )}
          </FormField>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={draft.showNotOfficialReceiptNotice}
              onChange={(e) => update({ showNotOfficialReceiptNotice: e.target.checked })}
            />
            Print “This document is not an official receipt.”
          </label>
        </fieldset>

        <div className="editor-actions">
          <div role="status" aria-live="polite" className="editor-status">
            {saveError && <p className="banner banner-error">{saveError}</p>}
            {saveMessage && <p className="banner banner-success">{saveMessage}</p>}
          </div>
          <button type="submit" className="button-secondary" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="button-primary"
            disabled={isSaving}
            onClick={() => void handleSave({ shouldPrint: true })}
          >
            Save &amp; download PDF
          </button>
        </div>
      </form>

      <div className="editor-preview">
        <DocumentPreview document={conversion.document} profile={profile} />
      </div>
    </div>
  );
}
