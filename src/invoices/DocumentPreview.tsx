import type { BusinessProfile } from '../business/types';
import { formatDisplayDate } from '../dates/dates';
import { formatMoney, formatQuantity, basisPointsToPlainText } from '../money/money';
import { DOCUMENT_KIND_CONFIG } from './documentKinds';
import { computeTotals } from './totals';
import type { BusinessDocument } from './types';

interface DocumentPreviewProps {
  document: BusinessDocument;
  profile: BusinessProfile;
}

/** The printable sheet. This exact markup is what ends up in the PDF. */
export function DocumentPreview({ document: doc, profile }: DocumentPreviewProps) {
  const config = DOCUMENT_KIND_CONFIG[doc.kind];
  const totals = computeTotals(doc);
  const money = (centavos: number) => formatMoney(centavos, doc.currency);
  const hasCustomer = doc.customer.name || doc.customer.address || doc.customer.contact;
  const hasPayment = config.amountPaidLabel !== null && totals.amountPaid > 0;

  return (
    <article className="sheet" aria-label={`${config.title} preview`}>
      <header className="sheet-header">
        <div className="sheet-seller">
          {profile.logoDataUrl && <img className="sheet-logo" src={profile.logoDataUrl} alt={`${profile.name} logo`} />}
          <div>
            <p className="sheet-seller-name">{profile.name || 'Your business name'}</p>
            {profile.address && <p className="sheet-muted sheet-multiline">{profile.address}</p>}
            {(profile.phone || profile.email) && (
              <p className="sheet-muted">{[profile.phone, profile.email].filter(Boolean).join(' · ')}</p>
            )}
            {profile.tin && <p className="sheet-muted">TIN: {profile.tin}</p>}
          </div>
        </div>
        <div className="sheet-title-block">
          <h2 className="sheet-title">{config.title}</h2>
          <dl className="sheet-meta">
            <dt>No.</dt>
            <dd>{doc.number || '—'}</dd>
            <dt>Date</dt>
            <dd>{formatDisplayDate(doc.issueDate)}</dd>
            {config.dueDateLabel && doc.dueDate && (
              <>
                <dt>{config.dueDateLabel}</dt>
                <dd>{formatDisplayDate(doc.dueDate)}</dd>
              </>
            )}
          </dl>
        </div>
      </header>

      {hasCustomer && (
        <section className="sheet-customer">
          <p className="sheet-label">{config.customerLabel}</p>
          {doc.customer.name && <p className="sheet-strong">{doc.customer.name}</p>}
          {doc.customer.address && <p className="sheet-multiline">{doc.customer.address}</p>}
          {doc.customer.contact && <p>{doc.customer.contact}</p>}
        </section>
      )}

      <div className="sheet-table-wrap">
        <table className="sheet-table">
          <thead>
            <tr>
              <th scope="col">Description</th>
              <th scope="col" className="numeric">Qty</th>
              <th scope="col" className="numeric">Unit price</th>
              <th scope="col" className="numeric">Amount</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((item, index) => (
              <tr key={item.id}>
                <td>{item.description || <span className="sheet-muted">Item description</span>}</td>
                <td className="numeric">
                  {formatQuantity(item.quantityThousandths)} {item.unit}
                </td>
                <td className="numeric">{money(item.unitPriceCentavos)}</td>
                <td className="numeric">{money(totals.lineAmounts[index])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="sheet-totals">
        <dt>Subtotal</dt>
        <dd>{money(totals.subtotal)}</dd>
        {totals.discount > 0 && (
          <>
            <dt>
              Discount
              {doc.discount.kind === 'percent' && ` (${basisPointsToPlainText(doc.discount.basisPoints)}%)`}
            </dt>
            <dd>−{money(totals.discount)}</dd>
          </>
        )}
        {totals.otherCharge > 0 && (
          <>
            <dt>{doc.otherCharge.label}</dt>
            <dd>{money(totals.otherCharge)}</dd>
          </>
        )}
        <dt className="sheet-grand">Total</dt>
        <dd className="sheet-grand">{money(totals.total)}</dd>
        {hasPayment && (
          <>
            <dt>{config.amountPaidLabel}</dt>
            <dd>−{money(totals.amountPaid)}</dd>
            <dt className="sheet-strong">Balance due</dt>
            <dd className="sheet-strong">{money(totals.balanceDue)}</dd>
          </>
        )}
      </dl>

      {config.showsPaymentMethods && profile.paymentMethods.length > 0 && (
        <section className="sheet-payment">
          <p className="sheet-label">Payment options</p>
          <ul>
            {profile.paymentMethods.map((method) => (
              <li key={method.id}>
                <span className="sheet-strong">{method.label}:</span> {method.details}
              </li>
            ))}
          </ul>
        </section>
      )}

      {doc.notes && <p className="sheet-notes sheet-multiline">{doc.notes}</p>}

      {config.signatureLabel && (
        <div className="sheet-signature">
          <div className="sheet-signature-line" />
          <p className="sheet-muted">{config.signatureLabel}</p>
        </div>
      )}

      {doc.showNotOfficialReceiptNotice && (
        <p className="sheet-notice">This document is not an official receipt.</p>
      )}
    </article>
  );
}
