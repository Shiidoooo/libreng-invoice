import type { DocumentKind } from './types';

export interface DocumentKindConfig {
  title: string;
  /** One line telling a non-accountant when to use this kind. */
  purpose: string;
  numberPrefix: string;
  customerLabel: string;
  /** Label for BusinessDocument.dueDate, or null when the kind has no such date. */
  dueDateLabel: string | null;
  /** Label for BusinessDocument.amountPaidCentavos, or null when the kind takes no payment. */
  amountPaidLabel: string | null;
  showsPaymentMethods: boolean;
  /** Text under the signature line, or null for no signature block. */
  signatureLabel: string | null;
}

export const DOCUMENT_KIND_CONFIG: Record<DocumentKind, DocumentKindConfig> = {
  invoice: {
    title: 'Invoice',
    purpose: 'Ask a customer to pay',
    numberPrefix: 'INV',
    customerLabel: 'Bill to',
    dueDateLabel: 'Due date',
    amountPaidLabel: 'Amount paid',
    showsPaymentMethods: true,
    signatureLabel: null,
  },
  quotation: {
    title: 'Quotation',
    purpose: 'Give a price before the work',
    numberPrefix: 'QUO',
    customerLabel: 'Prepared for',
    dueDateLabel: 'Valid until',
    amountPaidLabel: null,
    showsPaymentMethods: true,
    signatureLabel: 'Conforme (customer signature over printed name)',
  },
  acknowledgement_receipt: {
    title: 'Acknowledgement Receipt',
    purpose: 'Confirm you received payment',
    numberPrefix: 'AR',
    customerLabel: 'Received from',
    dueDateLabel: null,
    amountPaidLabel: 'Amount received',
    showsPaymentMethods: false,
    signatureLabel: 'Received by (signature over printed name)',
  },
  delivery_receipt: {
    title: 'Delivery Receipt',
    purpose: 'List items you delivered',
    numberPrefix: 'DR',
    customerLabel: 'Deliver to',
    dueDateLabel: null,
    amountPaidLabel: null,
    showsPaymentMethods: false,
    signatureLabel: 'Received the above items in good order and condition',
  },
};
