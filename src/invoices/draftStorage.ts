/**
 * Keeps the unsaved document of the current tab in sessionStorage, so it survives
 * the session ending (sign-out in another tab, expired login) and can be restored
 * after signing in again. sessionStorage is per tab and is cleared when the tab
 * closes. Keyed by user id so one account never sees another's draft.
 */
import { CURRENCIES } from '../money/money';
import type { DocumentDraft } from './draft';
import { DOCUMENT_KINDS } from './types';

const KEY_PREFIX = 'libreng-invoice.unsaved-draft:';

function storageKey(userId: string) {
  return `${KEY_PREFIX}${userId}`;
}

export function storeUnsavedDraft(userId: string, draft: DocumentDraft): void {
  try {
    window.sessionStorage.setItem(storageKey(userId), JSON.stringify(draft));
  } catch {
    // Storage full or blocked: losing the safety copy is acceptable.
  }
}

export function clearUnsavedDraft(userId: string): void {
  try {
    window.sessionStorage.removeItem(storageKey(userId));
  } catch {
    // Nothing to clear.
  }
}

const isString = (value: unknown): value is string => typeof value === 'string';

/** Structural check so a damaged copy is ignored rather than crashing the editor. */
export function isDocumentDraft(value: unknown): value is DocumentDraft {
  if (typeof value !== 'object' || value === null) return false;
  const draft = value as Record<string, unknown>;
  const customer = draft.customer as Record<string, unknown> | null;
  const textFields = [
    'id',
    'number',
    'issueDate',
    'dueDate',
    'discountText',
    'otherChargeLabel',
    'otherChargeText',
    'amountPaidText',
    'notes',
  ];
  return (
    textFields.every((field) => isString(draft[field])) &&
    typeof draft.isNew === 'boolean' &&
    typeof draft.showNotOfficialReceiptNotice === 'boolean' &&
    (draft.createdAt === null || isString(draft.createdAt)) &&
    (DOCUMENT_KINDS as readonly unknown[]).includes(draft.kind) &&
    (CURRENCIES as readonly unknown[]).includes(draft.currency) &&
    ['none', 'percent', 'fixed'].includes(draft.discountKind as string) &&
    typeof customer === 'object' &&
    customer !== null &&
    isString(customer.name) &&
    isString(customer.address) &&
    isString(customer.contact) &&
    Array.isArray(draft.items) &&
    draft.items.length > 0 &&
    draft.items.every((item: unknown) => {
      if (typeof item !== 'object' || item === null) return false;
      const line = item as Record<string, unknown>;
      return (
        ['id', 'description', 'quantityText', 'unit', 'unitPriceText', 'priceUnit', 'amountText'].every((field) =>
          isString(line[field]),
        ) && typeof line.isAmountEntered === 'boolean'
      );
    })
  );
}

/** The saved copy for this user, or null when there is none or it is damaged. */
export function takeUnsavedDraft(userId: string): DocumentDraft | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDocumentDraft(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
