import { useMemo, useState } from 'react';
import { formatDisplayDate } from '../dates/dates';
import { formatMoney } from '../money/money';
import { FormField } from '../ui/FormField';
import { DOCUMENT_KIND_CONFIG } from './documentKinds';
import { computeTotals, getPaymentStatus, type PaymentStatus } from './totals';
import { DOCUMENT_KINDS, type BusinessDocument, type DocumentKind } from './types';

const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  partial: 'Partially paid',
  paid: 'Paid',
};

interface DocumentHistoryProps {
  documents: BusinessDocument[];
  onOpen: (doc: BusinessDocument) => void;
  onDuplicate: (doc: BusinessDocument) => void;
  onMarkPaid: (doc: BusinessDocument) => Promise<void>;
  onDelete: (doc: BusinessDocument) => Promise<void>;
  onCreate: () => void;
}

export function DocumentHistory({ documents, onOpen, onDuplicate, onMarkPaid, onDelete, onCreate }: DocumentHistoryProps) {
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<DocumentKind | 'all'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const visibleDocuments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents
      .filter((doc) => kindFilter === 'all' || doc.kind === kindFilter)
      .filter(
        (doc) => query === '' || doc.number.toLowerCase().includes(query) || doc.customer.name.toLowerCase().includes(query),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [documents, search, kindFilter]);

  const runAction = async (doc: BusinessDocument, action: (doc: BusinessDocument) => Promise<void>) => {
    setBusyId(doc.id);
    setActionError(null);
    try {
      await action(doc);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = (doc: BusinessDocument) => {
    const title = DOCUMENT_KIND_CONFIG[doc.kind].title;
    if (window.confirm(`Delete ${title} ${doc.number}? This cannot be undone.`)) void runAction(doc, onDelete);
  };

  if (documents.length === 0) {
    return (
      <section className="card empty-state">
        <h2>No documents yet</h2>
        <p>Invoices, quotations and receipts you save will appear here.</p>
        <button type="button" className="button-primary" onClick={onCreate}>
          Create your first document
        </button>
      </section>
    );
  }

  return (
    <section className="history">
      <div className="history-filters card">
        <FormField label="Search number or customer">
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
      </div>

      <div role="status" aria-live="polite">
        {actionError && <p className="banner banner-error">{actionError}</p>}
      </div>

      {visibleDocuments.length === 0 ? (
        <p className="card">No documents match your search.</p>
      ) : (
        <div className="table-scroll card">
          <table className="history-table">
            <caption className="visually-hidden">Saved documents, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Number</th>
                <th scope="col">Type</th>
                <th scope="col">Customer</th>
                <th scope="col">Date</th>
                <th scope="col" className="numeric">Total</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleDocuments.map((doc) => {
                const totals = computeTotals(doc);
                const config = DOCUMENT_KIND_CONFIG[doc.kind];
                const status = doc.kind === 'invoice' ? getPaymentStatus(totals) : null;
                const isBusy = busyId === doc.id;
                return (
                  <tr key={doc.id}>
                    <th scope="row">
                      <button type="button" className="link-button" onClick={() => onOpen(doc)}>
                        {doc.number}
                      </button>
                    </th>
                    <td>{config.title}</td>
                    <td>{doc.customer.name || '—'}</td>
                    <td>{formatDisplayDate(doc.issueDate)}</td>
                    <td className="numeric">{formatMoney(totals.total, doc.currency)}</td>
                    <td>{status ? <span className={`badge badge-${status}`}>{PAYMENT_STATUS_LABEL[status]}</span> : '—'}</td>
                    <td className="row-actions">
                      {status && status !== 'paid' && (
                        <button type="button" className="button-quiet" disabled={isBusy} onClick={() => void runAction(doc, onMarkPaid)}>
                          Mark paid<span className="visually-hidden"> {doc.number}</span>
                        </button>
                      )}
                      <button type="button" className="button-quiet" onClick={() => onDuplicate(doc)}>
                        Duplicate<span className="visually-hidden"> {doc.number}</span>
                      </button>
                      <button type="button" className="button-danger" disabled={isBusy} onClick={() => handleDelete(doc)}>
                        Delete<span className="visually-hidden"> {doc.number}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
