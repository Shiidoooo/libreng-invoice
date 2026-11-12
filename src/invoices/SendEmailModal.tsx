import { useEffect, useState } from 'react';
import type { BusinessProfile } from '../business/types';
import { appConfig } from '../config/env';
import { describeError } from '../errors/reportError';
import { FormField } from '../ui/FormField';
import { Modal } from '../ui/Modal';
import { canShareFile, downloadFile } from './documentPdf';
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
import { sendDocumentEmail } from './emailSending';
import { printDocument } from './printDocument';
import { renderDocumentPdf } from './renderDocumentPdf';
import type { BusinessDocument } from './types';

interface SendEmailModalProps {
  /** The saved document to send, or null when the window is closed. */
  document: BusinessDocument | null;
  profile: BusinessProfile;
  /** The signed-in account's email: CC'd on emails sent from the app. */
  accountEmail: string;
  onClose: () => void;
}

/**
 * Prepares an email about a document, with the document as a PDF, and hands it to the
 * seller's own Gmail, email app or share sheet, so it is sent from their own account.
 * Edits here apply to this email only.
 */
export function SendEmailModal({ document, profile, accountEmail, onClose }: SendEmailModalProps) {
  return (
    <Modal isOpen={document !== null} title={document ? `Email ${document.number}` : 'Email'} onClose={onClose} size="large">
      {/* Keyed by document so each opening starts from the template, not the last edit. */}
      {document && (
        <SendEmailForm key={document.id} document={document} profile={profile} accountEmail={accountEmail} onClose={onClose} />
      )}
    </Modal>
  );
}

type CopyState = 'idle' | 'copied' | 'failed';

type SendState = { status: 'idle' } | { status: 'sending' } | { status: 'sent'; message: string } | { status: 'failed'; message: string };

const isSendingEnabled = appConfig.isValid && appConfig.config.isEmailSendingEnabled;

type PdfState = { status: 'making' } | { status: 'ready'; file: File } | { status: 'failed'; message: string };

/**
 * Makes the PDF once, when the window opens. Phones only allow sharing right after a
 * tap, so the file has to be ready before the person presses Share.
 */
function usePdfFile(document: BusinessDocument, profile: BusinessProfile): PdfState {
  const [pdf, setPdf] = useState<PdfState>({ status: 'making' });

  useEffect(() => {
    let isCurrent = true;
    renderDocumentPdf(document, profile).then(
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

  return pdf;
}

function SendEmailForm({ document, profile, accountEmail, onClose }: Required<Pick<SendEmailModalProps, 'profile' | 'accountEmail' | 'onClose'>> & { document: BusinessDocument }) {
  const [email, setEmail] = useState<EmailContent>(() => buildEmail(document, profile));
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const [sendState, setSendState] = useState<SendState>({ status: 'idle' });
  const pdf = usePdfFile(document, profile);
  const pdfFile = pdf.status === 'ready' ? pdf.file : null;
  const canSharePdf = pdfFile !== null && canShareFile(pdfFile);
  const canShareText = typeof navigator.share === 'function';

  const update = (changes: Partial<EmailContent>) => {
    setCopyState('idle');
    // Editing after a send means a new email, so the Send button becomes available again.
    setSendState((current) => (current.status === 'sending' ? current : { status: 'idle' }));
    setEmail((current) => ({ ...current, ...changes }));
  };

  const hasRecipient = email.to.trim() !== '';
  const isRecipientValid = !hasRecipient || isEmailAddress(email.to);
  const mailtoLink = buildMailtoLink(email);
  const isTooLongForMailto = mailtoLink.length > MAILTO_SAFE_LENGTH;

  const handleSend = async () => {
    if (!pdfFile || sendState.status === 'sending') return;
    if (!isEmailAddress(email.to)) {
      setSendState({ status: 'failed', message: 'Enter the customer’s email address in “Send to” first.' });
      return;
    }
    setSendState({ status: 'sending' });
    try {
      const sent = await sendDocumentEmail(email, pdfFile);
      const copyNote = sent.copySentTo ? ` A copy went to ${sent.copySentTo}.` : '';
      setSendState({ status: 'sent', message: `Sent to ${email.to.trim()} with the PDF attached.${copyNote}` });
    } catch (error) {
      setSendState({ status: 'failed', message: describeError(error, `email ${document.number}`) });
    }
  };

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
              Print or save as PDF
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

      {isSendingEnabled && (
        <div className="send-email-direct">
          <button
            type="button"
            className="button-primary button-large"
            disabled={pdfFile === null || sendState.status === 'sending' || sendState.status === 'sent'}
            onClick={() => void handleSend()}
          >
            {sendState.status === 'sending' ? 'Sending…' : sendState.status === 'sent' ? 'Sent ✓' : 'Send email with PDF'}
          </button>
          <p className="field-hint">
            Sent for you under your business name, with the PDF attached. You get a copy at {accountEmail}, and replies
            come to you.
          </p>
          <div role="status" aria-live="polite">
            {sendState.status === 'sent' && <p className="banner banner-success">{sendState.message}</p>}
            {sendState.status === 'failed' && <p className="banner banner-error">{sendState.message}</p>}
          </div>
        </div>
      )}

      {isSendingEnabled && <p className="send-email-or">or send it yourself</p>}
      <div className="send-email-actions">
        {canSharePdf && (
          <button type="button" className={isSendingEnabled ? 'button-secondary' : 'button-primary'} onClick={() => void handleShare()}>
            Share with PDF…
          </button>
        )}
        <a
          className={canSharePdf || isSendingEnabled ? 'button-secondary' : 'button-primary'}
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
