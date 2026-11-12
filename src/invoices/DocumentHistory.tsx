import { useMemo, useState } from 'react';
import { formatDisplayDate } from '../dates/dates';
import { formatMoney, type CurrencyCode } from '../money/money';
import { FormField } from '../ui/FormField';
import { describeError } from '../errors/reportError';
import { IconPlus } from '../ui/icons';
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
  onMarkPaid: (doc: BusinessDocument) => Promise<void>;
  onDelete: (doc: BusinessDocument) => Promise<void>;
  onCreate: () => void;
}

export function DocumentHistory({ documents, onOpen, onDuplicate, onEmail, onMarkPaid, onDelete, onCreate }: DocumentHistoryProps) {
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<DocumentKind | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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

  const runAction = async (doc: BusinessDocument, action: (doc: BusinessDocument) => Promise<void>, context: string) => {
    setBusyId(doc.id);
    setActionError(null);
    try {
      await action(doc);
    } catch (error) {
      setActionError(describeError(error, `${context} ${doc.number}`));
    } finally {
      setBusyId(null);
    }
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
                  <button type="button" className="document-card-open" onClick={() => void onOpen(doc)}>
                    <span className="document-card-customer">{doc.customer.name || 'No customer name'}</span>
                    <span className="document-card-meta">
                      <span className="document-card-number">{doc.number}</span>
                      <span>
                        {config.title} · {formatDisplayDate(doc.issueDate)}
                      </span>
                    </span>
                  </button>
                  <div className="document-card-amounts">
                    <strong>{formatMoney(totals.total, doc.currency)}</strong>
                    {status && <span className={`badge badge-${status}`}>{PAYMENT_STATUS_LABEL[status]}</span>}
                    {status === 'partial' && (
                      <span className="document-card-balance">Balance {formatMoney(totals.balanceDue, doc.currency)}</span>
                    )}
                  </div>
                </div>
                <div className="document-card-actions">
                  {status && status !== 'paid' && (
                    <button type="button" className="button-quiet" disabled={isBusy} onClick={() => void runAction(doc, onMarkPaid, 'mark as paid')}>
                      {isBusy ? 'Saving…' : 'Mark as paid'}
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
