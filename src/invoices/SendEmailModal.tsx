import { useEffect, useState } from 'react';
import type { BusinessProfile } from '../business/types';
import { appConfig } from '../config/env';
import { describeError } from '../errors/reportError';
import { FormField } from '../ui/FormField';
import { IconDownload } from '../ui/icons';
import { Modal } from '../ui/Modal';
import { canShareFile, downloadFile } from './documentPdf';
import {
  EMAIL_MESSAGE_MAX_LENGTH,
  EMAIL_SUBJECT_MAX_LENGTH,
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
 * Emails a document to a customer with its PDF attached. When sending from the app is
 * set up, the app sends it and copies the seller; otherwise the seller's own Gmail or
 * email app is opened with the message filled in. Edits here apply to this email only.
 */
export function SendEmailModal({ document, profile, accountEmail, onClose }: SendEmailModalProps) {
  return (
    <Modal isOpen={document !== null} title={document ? `Email ${document.number}` : 'Email'} onClose={onClose} size="large">
      {/* Keyed by document so each opening starts from the template, not the last edit. */}
      {document && <SendEmailForm key={document.id} document={document} profile={profile} accountEmail={accountEmail} />}
    </Modal>
  );
}

type SendState = { status: 'idle' } | { status: 'sending' } | { status: 'sent'; message: string } | { status: 'failed'; message: string };

type PdfState = { status: 'making' } | { status: 'ready'; file: File } | { status: 'failed'; message: string };

const isSendingEnabled = appConfig.isValid && appConfig.config.isEmailSendingEnabled;

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

interface SendEmailFormProps {
  document: BusinessDocument;
  profile: BusinessProfile;
  accountEmail: string;
}

function SendEmailForm({ document, profile, accountEmail }: SendEmailFormProps) {
  const [email, setEmail] = useState<EmailContent>(() => buildEmail(document, profile));
  const [sendState, setSendState] = useState<SendState>({ status: 'idle' });
  const pdf = usePdfFile(document, profile);
  const pdfFile = pdf.status === 'ready' ? pdf.file : null;
  const canSharePdf = pdfFile !== null && canShareFile(pdfFile);

  const update = (changes: Partial<EmailContent>) => {
    // Editing after a send means a new email, so the Send button becomes available again.
    setSendState((current) => (current.status === 'sending' ? current : { status: 'idle' }));
    setEmail((current) => ({ ...current, ...changes }));
  };

  const hasRecipient = email.to.trim() !== '';
  const isRecipientValid = !hasRecipient || isEmailAddress(email.to);

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

  const handleShare = async () => {
    if (!pdfFile) return;
    try {
      await navigator.share({ title: email.subject, text: email.message, files: [pdfFile] });
    } catch {
      // The person closed the share sheet; nothing to report.
    }
  };

  return (
    <div className="send-email">
      <div className="send-email-attachment" role="status" aria-live="polite">
        {pdf.status === 'making' && <span>Preparing the PDF…</span>}
        {pdf.status === 'ready' && (
          <>
            <span className="send-email-file">{pdf.file.name}</span>
            <span className="send-email-attachment-note">{isSendingEnabled ? 'will be attached' : 'attach this to your email'}</span>
            <button type="button" className="button-quiet button-small" onClick={() => downloadFile(pdf.file)}>
              <IconDownload /> Download
            </button>
          </>
        )}
        {pdf.status === 'failed' && (
          <>
            <span className="field-error">{pdf.message}</span>
            <button type="button" className="button-quiet button-small" onClick={() => printDocument(document.number)}>
              Print or save as PDF
            </button>
          </>
        )}
      </div>

      <div className="send-email-fields">
        <FormField
          label="Send to"
          isRequired={isSendingEnabled}
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
      </div>

      <FormField label="Message" hint="For this email only. Change the usual message in My business.">
        {(control) => (
          <textarea
            {...control}
            rows={7}
            maxLength={EMAIL_MESSAGE_MAX_LENGTH}
            value={email.message}
            onChange={(e) => update({ message: e.target.value })}
          />
        )}
      </FormField>

      {/* Stays at the bottom of the window while the fields scroll. */}
      <div className="send-email-footer">
        <div role="status" aria-live="polite">
          {sendState.status === 'sent' && <p className="banner banner-success">{sendState.message}</p>}
          {sendState.status === 'failed' && <p className="banner banner-error">{sendState.message}</p>}
        </div>
        <div className="send-email-actions">
          {isSendingEnabled ? (
            <button
              type="button"
              className="button-primary send-email-main"
              disabled={pdfFile === null || sendState.status === 'sending' || sendState.status === 'sent'}
              onClick={() => void handleSend()}
            >
              {sendState.status === 'sending' ? 'Sending…' : sendState.status === 'sent' ? 'Sent ✓' : 'Send email with PDF'}
            </button>
          ) : (
            <>
              <a className="button-primary send-email-main" href={buildGmailLink(email)} target="_blank" rel="noopener noreferrer">
                Open in Gmail
              </a>
              <a className="button-secondary" href={buildMailtoLink(email)}>
                Open my email app
              </a>
            </>
          )}
          {canSharePdf && (
            <button type="button" className="button-secondary" onClick={() => void handleShare()}>
              Share…
            </button>
          )}
        </div>
        {isSendingEnabled && (
          <p className="field-hint">
            Sent under your business name. A copy goes to {accountEmail}, and replies come to you.
          </p>
        )}
      </div>
    </div>
  );
}
