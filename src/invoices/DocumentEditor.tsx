import { useMemo, useState } from 'react';
import type { BusinessProfile } from '../business/types';
import { addDays } from '../dates/dates';
import { CURRENCIES, centavosToPlainText, formatMoney, formatQuantity, getCurrencySymbol, type CurrencyCode } from '../money/money';
import { describeError } from '../errors/reportError';
import { AffixInput } from '../ui/AffixInput';
import { FormField } from '../ui/FormField';
import { IconMail, IconPlus, IconTrash } from '../ui/icons';
import { DOCUMENT_KIND_CONFIG } from './documentKinds';
import { DocumentPreview } from './DocumentPreview';
import {
  DEFAULT_DUE_IN_DAYS,
  MAX_LINE_ITEMS,
  TEXT_LIMITS,
  convertDraft,
  createEmptyLineItem,
  type DocumentDraft,
  type LineItemDraft,
} from './draft';
import { isAutomaticNumber, suggestNextNumber, type NumberCounters } from './numbering';
import { printDocument } from './printDocument';
import { SendEmailModal } from './SendEmailModal';
import { computeTotals } from './totals';
import { priceUnitOptions, toMeasureUnitCode } from './units';
import { DOCUMENT_KINDS, type BusinessDocument, type Discount, type DocumentKind, type Party } from './types';

const COMMON_UNITS = ['pcs', 'pack', 'box', 'kg', 'g', 'L', 'mL', 'dozen', 'set', 'hr', 'day', 'session', 'lot'];
const EXTRA_FIELDS = ['discount', 'otherCharge', 'otherChargeLabel', 'amountPaid'];

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
  /** Open the email window as soon as the editor shows ("Email" pressed in My documents). */
  isEmailRequested?: boolean;
  onEmailClosed?: () => void;
}

type AfterSave = 'nothing' | 'print' | 'email';

type PaneOnMobile = 'form' | 'preview';

function hasExtras(draft: DocumentDraft): boolean {
  return draft.discountKind !== 'none' || draft.otherChargeText.trim() !== '' || draft.amountPaidText.trim() !== '';
}

export function DocumentEditor({
  draft,
  profile,
  counters,
  pastCustomers,
  onDraftChange,
  onSave,
  createId,
  now,
  isEmailRequested = false,
  onEmailClosed,
}: DocumentEditorProps) {
  const [hasTriedSave, setHasTriedSave] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [paneOnMobile, setPaneOnMobile] = useState<PaneOnMobile>('form');
  const [isExtrasOpen, setIsExtrasOpen] = useState(() => hasExtras(draft));
  const [emailDocument, setEmailDocument] = useState<BusinessDocument | null>(() =>
    // Saved documents opened from My documents are always valid, so this is the saved version.
    isEmailRequested ? convertDraft(draft, now().toISOString()).document : null,
  );

  const config = DOCUMENT_KIND_CONFIG[draft.kind];
  const conversion = useMemo(() => convertDraft(draft, now().toISOString()), [draft, now]);
  const totals = computeTotals(conversion.document);
  const visibleErrors = hasTriedSave ? conversion.errors : {};
  const currencySymbol = getCurrencySymbol(draft.currency);
  const money = (centavos: number) => formatMoney(centavos, draft.currency);
  const showsBalance = config.amountPaidLabel !== null && totals.amountPaid > 0;

  const update = (changes: Partial<DocumentDraft>) => {
    setSaveMessage(null);
    onDraftChange({ ...draft, ...changes });
  };
  const updateCustomer = (changes: Partial<Party>) => update({ customer: { ...draft.customer, ...changes } });
  const updateItem = (id: string, changes: Partial<LineItemDraft>) =>
    update({ items: draft.items.map((item) => (item.id === id ? { ...item, ...changes } : item)) });

  const handleKindChange = (kind: DocumentKind) => {
    const year = Number(draft.issueDate.slice(0, 4));
    // Swap the number only if it is still an automatic one (not typed by the user),
    // whatever year it was made for, so a quotation never keeps an INV- number.
    const isAutoNumber = draft.isNew && isAutomaticNumber(draft.kind, draft.number);
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

  const handleSave = async (afterSave: AfterSave) => {
    setHasTriedSave(true);
    setSaveError(null);
    setSaveMessage(null);
    if (!conversion.isValid) {
      const errorFields = Object.keys(conversion.errors);
      if (errorFields.some((field) => EXTRA_FIELDS.includes(field))) setIsExtrasOpen(true);
      setPaneOnMobile('form');
      setSaveError(`Please fix ${errorFields.length === 1 ? 'the field' : `the ${errorFields.length} fields`} marked in red.`);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(conversion.document);
      setSaveMessage(
        afterSave === 'print' ? 'Saved. Choose “Save as PDF” in the print window.' : `Saved ${conversion.document.number}.`,
      );
      if (afterSave === 'print') printDocument(conversion.document.number);
      if (afterSave === 'email') setEmailDocument(conversion.document);
    } catch (error) {
      setSaveError(describeError(error, `save ${conversion.document.number}`, 'Could not save. Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="editor" data-pane={paneOnMobile}>
      <div className="pane-switch" role="group" aria-label="Show">
        <button type="button" aria-pressed={paneOnMobile === 'form'} onClick={() => setPaneOnMobile('form')}>
          Fill in
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
          void handleSave('nothing');
        }}
      >
        <fieldset className="card">
          <legend>What are you making?</legend>
          <div className="kind-picker">
            {DOCUMENT_KINDS.map((kind) => (
              <label key={kind} className="kind-option">
                <input
                  type="radio"
                  name="document-kind"
                  value={kind}
                  checked={draft.kind === kind}
                  onChange={() => handleKindChange(kind)}
                />
                <span className="kind-option-title">{DOCUMENT_KIND_CONFIG[kind].title}</span>
                <span className="kind-option-purpose">{DOCUMENT_KIND_CONFIG[kind].purpose}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="card">
          <legend>{config.customerLabel}</legend>
          <FormField label="Customer name" error={visibleErrors['customer.name']} hint="Pick a past customer to fill in their details.">
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
          <div className="grid-2">
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
            <FormField label="Phone or email" error={visibleErrors['customer.contact']}>
              {(control) => (
                <input
                  {...control}
                  value={draft.customer.contact}
                  maxLength={TEXT_LIMITS.partyContact}
                  onChange={(e) => updateCustomer({ contact: e.target.value })}
                />
              )}
            </FormField>
          </div>
        </fieldset>

        <fieldset className="card">
          <legend>Items</legend>
          {visibleErrors.items && <p className="field-error">{visibleErrors.items}</p>}
          <ol className="items">
            {draft.items.map((item, index) => {
              const prefix = `items.${item.id}`;
              const priceOptions = priceUnitOptions(item.unit);
              const quantityUnitCode = toMeasureUnitCode(item.unit);
              const lineItem = conversion.document.items[index];
              return (
                <li key={item.id} className="item-card">
                  <div className="item-card-header">
                    <span className="item-card-number">Item {index + 1}</span>
                    <span className="item-card-amount">{money(totals.lineAmounts[index] ?? 0)}</span>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove item ${index + 1}${item.description ? `: ${item.description}` : ''}`}
                      disabled={draft.items.length === 1}
                      onClick={() => update({ items: draft.items.filter((other) => other.id !== item.id) })}
                    >
                      <IconTrash />
                    </button>
                  </div>
                  <FormField label="Description" isRequired error={visibleErrors[`${prefix}.description`]}>
                    {(control) => (
                      <input
                        {...control}
                        placeholder="e.g. Coke 1.5L, Logo design"
                        value={item.description}
                        maxLength={TEXT_LIMITS.itemDescription}
                        onChange={(e) => updateItem(item.id, { description: e.target.value })}
                      />
                    )}
                  </FormField>
                  <div className="item-numbers">
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
                          onChange={(e) => {
                            const unit = e.target.value;
                            // Drop a "per kg" choice that no longer fits the new unit (e.g. changed to "pcs").
                            const priceUnit = priceUnitOptions(unit).includes(item.priceUnit) ? item.priceUnit : '';
                            updateItem(item.id, { unit, priceUnit });
                          }}
                        />
                      )}
                    </FormField>
                    {item.isAmountEntered ? (
                      <FormField label="Amount" isRequired error={visibleErrors[`${prefix}.amount`]}>
                        {(control) => (
                          <AffixInput
                            {...control}
                            prefix={currencySymbol}
                            inputMode="decimal"
                            placeholder="0.00"
                            value={item.amountText}
                            onChange={(e) => updateItem(item.id, { amountText: e.target.value })}
                          />
                        )}
                      </FormField>
                    ) : (
                    <FormField
                      label={priceOptions.length > 0 ? 'Price' : 'Price each'}
                      error={visibleErrors[`${prefix}.unitPrice`]}
                    >
                      {(control) => (
                        <div className="price-with-unit">
                          <AffixInput
                            {...control}
                            prefix={currencySymbol}
                            inputMode="decimal"
                            placeholder="0.00"
                            value={item.unitPriceText}
                            onChange={(e) => updateItem(item.id, { unitPriceText: e.target.value })}
                          />
                          {priceOptions.length > 0 && (
                            <select
                              className="price-unit-select"
                              aria-label={`Item ${index + 1} price is per`}
                              value={item.priceUnit || quantityUnitCode || ''}
                              onChange={(e) =>
                                updateItem(item.id, { priceUnit: e.target.value === quantityUnitCode ? '' : e.target.value })
                              }
                            >
                              {priceOptions.map((code) => (
                                <option key={code} value={code}>
                                  per {code}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                    </FormField>
                    )}
                  </div>
                  <label className="checkbox item-amount-toggle">
                    <input
                      type="checkbox"
                      checked={item.isAmountEntered}
                      onChange={(e) =>
                        updateItem(item.id, {
                          isAmountEntered: e.target.checked,
                          // Start from the current computed amount so the field is never blank.
                          amountText:
                            e.target.checked && item.amountText === '' && (totals.lineAmounts[index] ?? 0) > 0
                              ? centavosToPlainText(totals.lineAmounts[index])
                              : item.amountText,
                        })
                      }
                    />
                    Type the amount myself
                    <span className="field-hint">(no price × quantity)</span>
                  </label>
                  {lineItem?.priceUnit && (
                    <p className="item-calculation">
                      {formatQuantity(lineItem.quantityThousandths)} {lineItem.unit} × {money(lineItem.unitPriceCentavos)}/
                      {lineItem.priceUnit} = <strong>{money(totals.lineAmounts[index] ?? 0)}</strong>
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
          <datalist id="common-units">
            {COMMON_UNITS.map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>
          <button
            type="button"
            className="button-secondary"
            disabled={draft.items.length >= MAX_LINE_ITEMS}
            onClick={() => update({ items: [...draft.items, createEmptyLineItem(createId())] })}
          >
            <IconPlus /> Add another item
          </button>
        </fieldset>

        <details className="card extras" open={isExtrasOpen} onToggle={(e) => setIsExtrasOpen(e.currentTarget.open)}>
          <summary>
            <span className="extras-title">Discount, fees{config.amountPaidLabel ? ' & payment' : ''}</span>
            <span className="field-hint">Optional</span>
          </summary>
          <div className="grid-2">
            <FormField label="Discount">
              {(control) => (
                <select
                  {...control}
                  value={draft.discountKind}
                  onChange={(e) => update({ discountKind: e.target.value as Discount['kind'], discountText: '' })}
                >
                  <option value="none">No discount</option>
                  <option value="percent">Percent off (%)</option>
                  <option value="fixed">Amount off ({currencySymbol})</option>
                </select>
              )}
            </FormField>
            {draft.discountKind !== 'none' && (
              <FormField
                label={draft.discountKind === 'percent' ? 'Discount percent' : 'Discount amount'}
                error={visibleErrors.discount}
              >
                {(control) => (
                  <AffixInput
                    {...control}
                    prefix={draft.discountKind === 'fixed' ? currencySymbol : undefined}
                    suffix={draft.discountKind === 'percent' ? '%' : undefined}
                    inputMode="decimal"
                    value={draft.discountText}
                    onChange={(e) => update({ discountText: e.target.value })}
                  />
                )}
              </FormField>
            )}
            <FormField label="Extra fee name" error={visibleErrors.otherChargeLabel} hint="e.g. Delivery fee, Rush fee">
              {(control) => (
                <input
                  {...control}
                  value={draft.otherChargeLabel}
                  maxLength={TEXT_LIMITS.chargeLabel}
                  onChange={(e) => update({ otherChargeLabel: e.target.value })}
                />
              )}
            </FormField>
            <FormField label="Extra fee amount" error={visibleErrors.otherCharge}>
              {(control) => (
                <AffixInput
                  {...control}
                  prefix={currencySymbol}
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
                hint={draft.kind === 'invoice' ? 'Down payment or partial payment already received.' : undefined}
              >
                {(control) => (
                  <AffixInput
                    {...control}
                    prefix={currencySymbol}
                    inputMode="decimal"
                    placeholder="0.00"
                    value={draft.amountPaidText}
                    onChange={(e) => update({ amountPaidText: e.target.value })}
                  />
                )}
              </FormField>
            )}
          </div>
        </details>

        <fieldset className="card">
          <legend>Details</legend>
          <div className="grid-2">
            <FormField label="Document number" isRequired error={visibleErrors.number} hint="Filled in for you. You can change it.">
              {(control) => (
                <input
                  {...control}
                  value={draft.number}
                  maxLength={TEXT_LIMITS.number}
                  onChange={(e) => update({ number: e.target.value })}
                />
              )}
            </FormField>
            <FormField label="Currency">
              {(control) => (
                <select {...control} value={draft.currency} onChange={(e) => update({ currency: e.target.value as CurrencyCode })}>
                  {CURRENCIES.map((code) => (
                    <option key={code} value={code}>
                      {code} ({getCurrencySymbol(code)})
                    </option>
                  ))}
                </select>
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
          </div>
          <FormField label="Notes or terms" error={visibleErrors.notes} hint="Printed at the bottom, e.g. “Thank you!” or payment terms.">
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

        <div className="action-bar">
          <div className="action-bar-total">
            <span className="action-bar-label">{showsBalance ? 'Balance due' : 'Total'}</span>
            <strong className="action-bar-amount">{money(showsBalance ? totals.balanceDue : totals.total)}</strong>
          </div>
          <div className="action-bar-buttons">
            <button
              type="button"
              className="button-secondary action-bar-email"
              disabled={isSaving}
              aria-label="Save and email"
              onClick={() => void handleSave('email')}
            >
              <IconMail />
              <span className="action-bar-email-text">Email</span>
            </button>
            <button type="submit" className="button-secondary" disabled={isSaving}>
              {isSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              className="button-primary"
              disabled={isSaving}
              onClick={() => void handleSave('print')}
            >
              Save &amp; get PDF
            </button>
          </div>
          <div role="status" aria-live="polite" className="action-bar-status">
            {saveError && <p className="banner banner-error">{saveError}</p>}
            {saveMessage && <p className="banner banner-success">{saveMessage}</p>}
          </div>
        </div>
      </form>

      <div className="editor-preview">
        <DocumentPreview document={conversion.document} profile={profile} />
      </div>
      <SendEmailModal document={emailDocument} profile={profile} onClose={() => {
          setEmailDocument(null);
          onEmailClosed?.();
        }}
      />
    </div>
  );
}
