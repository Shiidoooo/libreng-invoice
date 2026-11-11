import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { BusinessProfile } from '../business/types';
import { describeError } from '../errors/reportError';
import { FormField } from '../ui/FormField';
import { Modal } from '../ui/Modal';
import { DocumentPreview } from './DocumentPreview';
import { PDF_SHEET_WIDTH_PX, canShareFile, createDocumentPdf, downloadFile } from './documentPdf';
import {
  EMAIL_MESSAGE_MAX_LENGTH,
  EMAIL_SUBJECT_MAX_LENGTH,
  MAILTO_SAFE_LENGTH,
  buildEmail,
  buildGmailLink,
  buildMailtoLink,
  isEmailAddress,
  type EmailContent,
} from './emailMessage';
import { printDocument } from './printDocument';
import type { BusinessDocument } from './types';

interface SendEmailModalProps {
  /** The saved document to send, or null when the window is closed. */
  document: BusinessDocument | null;
  profile: BusinessProfile;
  onClose: () => void;
}

/**
 * Prepares an email about a document, with the document as a PDF, and hands it to the
 * seller's own Gmail, email app or share sheet, so it is sent from their own account.
 * Edits here apply to this email only.
 */
export function SendEmailModal({ document, profile, onClose }: SendEmailModalProps) {
  return (
    <Modal isOpen={document !== null} title={document ? `Email ${document.number}` : 'Email'} onClose={onClose} size="large">
      {/* Keyed by document so each opening starts from the template, not the last edit. */}
      {document && <SendEmailForm key={document.id} document={document} profile={profile} onClose={onClose} />}
    </Modal>
  );
}

type CopyState = 'idle' | 'copied' | 'failed';

type PdfState = { status: 'making' } | { status: 'ready'; file: File } | { status: 'failed'; message: string };

/**
 * Lays the sheet out off-screen at A4 width (whatever the screen size) and turns it into
 * a PDF file once, when the window opens. Phones only allow sharing right after a tap,
 * so the file has to be ready before the person presses Share.
 */
function usePdfFile(document: BusinessDocument, profile: BusinessProfile) {
  const sheetHostRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PdfState>({ status: 'making' });

  useEffect(() => {
    let isCurrent = true;
    const sheet = sheetHostRef.current?.querySelector<HTMLElement>('.sheet');
    if (!sheet) return;
    createDocumentPdf(sheet, document.number).then(
      (file) => {
        if (isCurrent) setPdf({ status: 'ready', file });
      },
      (error: unknown) => {
        if (isCurrent) setPdf({ status: 'failed', message: describeError(error, 'make the PDF') });
      },
    );
    return () => {
      isCurrent = false;
    };
  }, [document, profile]);

  const renderArea = createPortal(
    <div ref={sheetHostRef} className="pdf-render-area" style={{ width: PDF_SHEET_WIDTH_PX }} aria-hidden="true">
      <DocumentPreview document={document} profile={profile} />
    </div>,
    window.document.body,
  );
  return { pdf, renderArea };
}

function SendEmailForm({ document, profile, onClose }: { document: BusinessDocument; profile: BusinessProfile; onClose: () => void }) {
  const [email, setEmail] = useState<EmailContent>(() => buildEmail(document, profile));
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const { pdf, renderArea } = usePdfFile(document, profile);
  const pdfFile = pdf.status === 'ready' ? pdf.file : null;
  const canSharePdf = pdfFile !== null && canShareFile(pdfFile);
  const canShareText = typeof navigator.share === 'function';

  const update = (changes: Partial<EmailContent>) => {
    setCopyState('idle');
    setEmail((current) => ({ ...current, ...changes }));
  };

  const hasRecipient = email.to.trim() !== '';
  const isRecipientValid = !hasRecipient || isEmailAddress(email.to);
  const mailtoLink = buildMailtoLink(email);
  const isTooLongForMailto = mailtoLink.length > MAILTO_SAFE_LENGTH;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${email.subject}\n\n${email.message}`);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: email.subject,
        text: email.message,
        ...(canSharePdf && pdfFile ? { files: [pdfFile] } : {}),
      });
    } catch {
      // The person closed the share sheet; nothing to report.
    }
  };

  return (
    <div className="send-email">
      {renderArea}
      <div className="send-email-pdf" role="status" aria-live="polite">
        {pdf.status === 'making' && <p className="send-email-pdf-text">Making the PDF of {document.number}…</p>}
        {pdf.status === 'ready' && (
          <>
            <p className="send-email-pdf-text">
              <strong>{pdf.file.name}</strong> is ready.{' '}
              {canSharePdf
                ? 'Press “Share with PDF” and pick Gmail, Messenger or Viber. The PDF is attached for you.'
                : 'Download it, open Gmail or your email app, and attach it there.'}
            </p>
            <button type="button" className="button-secondary" onClick={() => downloadFile(pdf.file)}>
              Download PDF
            </button>
          </>
        )}
        {pdf.status === 'failed' && (
          <>
            <p className="banner banner-error">{pdf.message}</p>
            <button type="button" className="button-secondary" onClick={() => printDocument(document.number)}>
              Get PDF
            </button>
          </>
        )}
      </div>

      <FormField
        label="Send to"
        hint={hasRecipient ? undefined : 'Optional. You can also type it in your email app.'}
        error={isRecipientValid ? undefined : 'This does not look like an email address.'}
      >
        {(control) => (
          <input
            {...control}
            type="email"
            inputMode="email"
            autoComplete="off"
            maxLength={254}
            value={email.to}
            placeholder="customer@example.com"
            onChange={(e) => update({ to: e.target.value })}
          />
        )}
      </FormField>

      <FormField label="Subject">
        {(control) => (
          <input
            {...control}
            maxLength={EMAIL_SUBJECT_MAX_LENGTH}
            value={email.subject}
            onChange={(e) => update({ subject: e.target.value })}
          />
        )}
      </FormField>

      <FormField label="Message" hint="Changes here are for this email only. Edit the template in My business.">
        {(control) => (
          <textarea
            {...control}
            rows={10}
            maxLength={EMAIL_MESSAGE_MAX_LENGTH}
            value={email.message}
            onChange={(e) => update({ message: e.target.value })}
          />
        )}
      </FormField>

      {isTooLongForMailto && (
        <p className="banner banner-info">
          This message is long. If your email app cuts it off, use Gmail or copy the message instead.
        </p>
      )}

      <div className="send-email-actions">
        {canSharePdf && (
          <button type="button" className="button-primary" onClick={() => void handleShare()}>
            Share with PDF…
          </button>
        )}
        <a
          className={canSharePdf ? 'button-secondary' : 'button-primary'}
          href={buildGmailLink(email)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open in Gmail
        </a>
        <a className="button-secondary" href={mailtoLink}>
          Open my email app
        </a>
        <button type="button" className="button-secondary" onClick={() => void handleCopy()}>
          {copyState === 'copied' ? 'Copied' : 'Copy message'}
        </button>
        {canShareText && !canSharePdf && (
          <button type="button" className="button-secondary" onClick={() => void handleShare()}>
            Share message…
          </button>
        )}
        <button type="button" className="button-quiet" onClick={onClose}>
          Close
        </button>
      </div>
      <div role="status" aria-live="polite">
        {copyState === 'copied' && <p className="banner banner-success">Subject and message copied. Paste them into your email.</p>}
        {copyState === 'failed' && (
          <p className="banner banner-error">Could not copy. Select the message above and copy it yourself.</p>
        )}
      </div>
    </div>
  );
}
