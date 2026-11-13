import { useMemo, useState } from 'react';
import { formatDisplayDate } from '../dates/dates';
import { formatMoney, type CurrencyCode } from '../money/money';
import { FormField } from '../ui/FormField';
import { describeError } from '../errors/reportError';
import { IconEdit, IconPlus } from '../ui/icons';
import { useConfirm } from '../ui/useConfirm';
import { DOCUMENT_KIND_CONFIG } from './documentKinds';
import { computeTotals, getPaymentStatus, type DocumentTotals, type PaymentStatus } from './totals';
import { DOCUMENT_KINDS, type BusinessDocument, type DocumentKind } from './types';

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Partly paid',
  paid: 'Paid',
};

type StatusFilter = 'all' | 'to_collect' | 'paid';

interface DocumentRow {
  doc: BusinessDocument;
  totals: DocumentTotals;
  /** Only invoices have a payment status. */
  status: PaymentStatus | null;
}

interface DocumentHistoryProps {
  documents: BusinessDocument[];
  onOpen: (doc: BusinessDocument) => void | Promise<void>;
  onDuplicate: (doc: BusinessDocument) => void | Promise<void>;
  /** Opens the document with the email window on top. */
  onEmail: (doc: BusinessDocument) => void | Promise<void>;
  /** Saves a new amount paid: the full total (paid), 0 (unpaid), or the earlier amount (undo). */
  onSetAmountPaid: (doc: BusinessDocument, amountPaidCentavos: number) => Promise<void>;
  onDelete: (doc: BusinessDocument) => Promise<void>;
  onCreate: () => void;
}

/** The last payment change, so it can be undone with one tap. */
interface PaymentChange {
  documentId: string;
  message: string;
  previousAmountCentavos: number;
}

export function DocumentHistory({ documents, onOpen, onDuplicate, onEmail, onSetAmountPaid, onDelete, onCreate }: DocumentHistoryProps) {
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<DocumentKind | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lastPaymentChange, setLastPaymentChange] = useState<PaymentChange | null>(null);
  const { confirm, confirmDialog } = useConfirm();

  const rows = useMemo<DocumentRow[]>(
    () =>
      documents
        .map((doc) => {
          const totals = computeTotals(doc);
          return { doc, totals, status: doc.kind === 'invoice' ? getPaymentStatus(totals) : null };
        })
        .sort((a, b) => b.doc.updatedAt.localeCompare(a.doc.updatedAt)),
    [documents],
  );

  /** Outstanding balance per currency, so ₱ and $ are never added together. */
  const toCollect = useMemo(() => {
    const byCurrency = new Map<CurrencyCode, number>();
    let count = 0;
    for (const row of rows) {
      if (row.status === 'unpaid' || row.status === 'partial') {
        count += 1;
        byCurrency.set(row.doc.currency, (byCurrency.get(row.doc.currency) ?? 0) + row.totals.balanceDue);
      }
    }
    return { count, amounts: [...byCurrency.entries()].map(([currency, centavos]) => formatMoney(centavos, currency)) };
  }, [rows]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter(({ doc, status }) => {
      if (kindFilter !== 'all' && doc.kind !== kindFilter) return false;
      if (statusFilter === 'to_collect' && status !== 'unpaid' && status !== 'partial') return false;
      if (statusFilter === 'paid' && status !== 'paid') return false;
      return query === '' || doc.number.toLowerCase().includes(query) || doc.customer.name.toLowerCase().includes(query);
    });
  }, [rows, search, kindFilter, statusFilter]);

  /** Runs one action on a document. Resolves true when it succeeded. */
  const runAction = async (doc: BusinessDocument, action: (doc: BusinessDocument) => Promise<void>, context: string) => {
    setBusyId(doc.id);
    setActionError(null);
    setLastPaymentChange(null);
    try {
      await action(doc);
      return true;
    } catch (error) {
      setActionError(describeError(error, `${context} ${doc.number}`));
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const handleMarkPaid = async (doc: BusinessDocument, totals: DocumentTotals) => {
    const isConfirmed = await confirm({
      title: 'Mark as paid?',
      message: (
        <p>
          This records <strong>{formatMoney(totals.balanceDue, doc.currency)}</strong> as received
          {doc.customer.name && <> from {doc.customer.name}</>}, so <strong>{doc.number}</strong> shows as fully paid. You
          can undo it right after, or mark it unpaid later.
        </p>
      ),
      confirmLabel: `Mark ${doc.number} as paid`,
    });
    if (!isConfirmed) return;
    const previous = doc.amountPaidCentavos;
    if (await runAction(doc, (current) => onSetAmountPaid(current, totals.total), 'mark as paid')) {
      setLastPaymentChange({ documentId: doc.id, message: `${doc.number} marked as paid.`, previousAmountCentavos: previous });
    }
  };

  const handleMarkUnpaid = async (doc: BusinessDocument) => {
    const isConfirmed = await confirm({
      title: 'Mark as unpaid?',
      message: (
        <p>
          The payment of <strong>{formatMoney(doc.amountPaidCentavos, doc.currency)}</strong> on <strong>{doc.number}</strong>{' '}
          will be cleared, and the full amount shows as still to collect. To record only part of a payment instead, use
          Edit.
        </p>
      ),
      confirmLabel: `Mark ${doc.number} as unpaid`,
      tone: 'danger',
    });
    if (!isConfirmed) return;
    const previous = doc.amountPaidCentavos;
    if (await runAction(doc, (current) => onSetAmountPaid(current, 0), 'mark as unpaid')) {
      setLastPaymentChange({ documentId: doc.id, message: `${doc.number} marked as unpaid.`, previousAmountCentavos: previous });
    }
  };

  const handleUndoPaymentChange = async () => {
    const change = lastPaymentChange;
    // Use the latest saved version, not the one from before the change.
    const doc = documents.find((candidate) => candidate.id === change?.documentId);
    if (!change || !doc) {
      setLastPaymentChange(null);
      return;
    }
    await runAction(doc, (current) => onSetAmountPaid(current, change.previousAmountCentavos), 'undo the payment change on');
  };

  const handleDelete = async (doc: BusinessDocument) => {
    const title = DOCUMENT_KIND_CONFIG[doc.kind].title;
    const isConfirmed = await confirm({
      title: `Delete ${title.toLowerCase()}?`,
      message: (
        <p>
          <strong>
            {title} {doc.number}
          </strong>
          {doc.customer.name && <> for {doc.customer.name}</>} will be deleted permanently. This cannot be undone.
        </p>
      ),
      confirmLabel: `Delete ${doc.number}`,
      tone: 'danger',
    });
    if (isConfirmed) await runAction(doc, onDelete, 'delete');
  };

  if (documents.length === 0) {
    return (
      <section className="card empty-state">
        <h2>No documents yet</h2>
        <p>Invoices, quotations and receipts you save will appear here.</p>
        <button type="button" className="button-primary" onClick={onCreate}>
          <IconPlus /> Create your first invoice
        </button>
      </section>
    );
  }

  return (
    <section className="history" aria-labelledby="history-heading">
      <div className="page-heading">
        <h2 id="history-heading">My documents</h2>
        <button type="button" className="button-primary" onClick={onCreate}>
          <IconPlus /> New document
        </button>
      </div>

      <div className="stat-row">
        <div className="stat card">
          <span className="stat-label">Still to collect</span>
          <strong className={toCollect.count > 0 ? 'stat-value stat-value-marked' : 'stat-value'}>
            {toCollect.amounts.length > 0 ? toCollect.amounts.join(' + ') : formatMoney(0, 'PHP')}
          </strong>
          <span className="stat-detail">
            {toCollect.count === 0 ? 'All invoices are paid' : `${toCollect.count} unpaid or partly paid invoice${toCollect.count === 1 ? '' : 's'}`}
          </span>
        </div>
        <div className="stat card">
          <span className="stat-label">Saved documents</span>
          <strong className="stat-value">{documents.length}</strong>
          <span className="stat-detail">Invoices, quotations and receipts</span>
        </div>
      </div>

      <div className="history-filters card">
        <FormField label="Search by number or customer">
          {(control) => <input {...control} type="search" value={search} onChange={(e) => setSearch(e.target.value)} />}
        </FormField>
        <FormField label="Type">
          {(control) => (
            <select {...control} value={kindFilter} onChange={(e) => setKindFilter(e.target.value as DocumentKind | 'all')}>
              <option value="all">All types</option>
              {DOCUMENT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {DOCUMENT_KIND_CONFIG[kind].title}
                </option>
              ))}
            </select>
          )}
        </FormField>
        <FormField label="Payment">
          {(control) => (
            <select {...control} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
              <option value="all">Any</option>
              <option value="to_collect">Not fully paid</option>
              <option value="paid">Paid</option>
            </select>
          )}
        </FormField>
      </div>

      <div role="status" aria-live="polite">
        {actionError && <p className="banner banner-error">{actionError}</p>}
        {lastPaymentChange && (
          <div className="banner banner-success undo-banner">
            <span>{lastPaymentChange.message}</span>
            <button
              type="button"
              className="button-quiet button-small"
              disabled={busyId === lastPaymentChange.documentId}
              onClick={() => void handleUndoPaymentChange()}
            >
              Undo
            </button>
          </div>
        )}
      </div>

      {visibleRows.length === 0 ? (
        <p className="card">No documents match. Try clearing the search or filters.</p>
      ) : (
        <ul className="document-list">
          {visibleRows.map(({ doc, totals, status }) => {
            const config = DOCUMENT_KIND_CONFIG[doc.kind];
            const isBusy = busyId === doc.id;
            return (
              <li key={doc.id} className="document-card card">
                <div className="document-card-main">
                  <div className="document-card-summary">
                    <h3 className="document-card-customer">{doc.customer.name || 'No customer name'}</h3>
                    <span className="document-card-meta">
                      <span className="document-card-number">{doc.number}</span>
                      <span>
                        {config.title} · {formatDisplayDate(doc.issueDate)}
                      </span>
                    </span>
                  </div>
                  <div className="document-card-amounts">
                    <strong>{formatMoney(totals.total, doc.currency)}</strong>
                    {status && <span className={`badge badge-${status}`}>{PAYMENT_STATUS_LABEL[status]}</span>}
                    {status === 'partial' && (
                      <span className="document-card-balance">Balance {formatMoney(totals.balanceDue, doc.currency)}</span>
                    )}
                  </div>
                </div>
                <div className="document-card-actions">
                  <button type="button" className="button-secondary" onClick={() => void onOpen(doc)}>
                    <IconEdit /> Edit<span className="visually-hidden"> {doc.number}</span>
                  </button>
                  {status && status !== 'paid' && (
                    <button type="button" className="button-quiet" disabled={isBusy} onClick={() => void handleMarkPaid(doc, totals)}>
                      {isBusy ? 'Saving…' : 'Mark as paid'}
                      <span className="visually-hidden"> {doc.number}</span>
                    </button>
                  )}
                  {status === 'paid' && doc.amountPaidCentavos > 0 && (
                    <button type="button" className="button-quiet" disabled={isBusy} onClick={() => void handleMarkUnpaid(doc)}>
                      {isBusy ? 'Saving…' : 'Mark as unpaid'}
                      <span className="visually-hidden"> {doc.number}</span>
                    </button>
                  )}
                  <button type="button" className="button-quiet" onClick={() => void onEmail(doc)}>
                    Email<span className="visually-hidden"> {doc.number}</span>
                  </button>
                  <button type="button" className="button-quiet" onClick={() => void onDuplicate(doc)}>
                    Make a copy<span className="visually-hidden"> of {doc.number}</span>
                  </button>
                  <button type="button" className="button-danger" disabled={isBusy} onClick={() => void handleDelete(doc)}>
                    Delete<span className="visually-hidden"> {doc.number}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {confirmDialog}
    </section>
  );
}
