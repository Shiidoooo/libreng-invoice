import { useState } from 'react';
import type { BusinessProfile } from '../business/types';
import { FormField } from '../ui/FormField';
import { Modal } from '../ui/Modal';
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
 * Prepares an email about a document and hands it to the seller's own Gmail or email app,
 * so it is sent from their address. Edits here apply to this email only.
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

function SendEmailForm({ document, profile, onClose }: { document: BusinessDocument; profile: BusinessProfile; onClose: () => void }) {
  const [email, setEmail] = useState<EmailContent>(() => buildEmail(document, profile));
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const update = (changes: Partial<EmailContent>) => {
    setCopyState('idle');
    setEmail((current) => ({ ...current, ...changes }));
  };

  const hasRecipient = email.to.trim() !== '';
  const isRecipientValid = !hasRecipient || isEmailAddress(email.to);
  const mailtoLink = buildMailtoLink(email);
  const isTooLongForMailto = mailtoLink.length > MAILTO_SAFE_LENGTH;
  const canShare = typeof navigator.share === 'function';

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
      await navigator.share({ title: email.subject, text: email.message });
    } catch {
      // The person closed the share sheet; nothing to report.
    }
  };

  return (
    <div className="send-email">
      <ol className="send-email-steps">
        <li>
          <strong>Get the PDF first.</strong> Press <em>Get PDF</em>, choose “Save as PDF” and save it.{' '}
          <button type="button" className="button-quiet" onClick={() => printDocument(document.number)}>
            Get PDF
          </button>
        </li>
        <li>
          <strong>Check the email below,</strong> then open Gmail or your email app. Attach the PDF there and press Send.
        </li>
      </ol>

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
        <a className="button-primary" href={buildGmailLink(email)} target="_blank" rel="noopener noreferrer">
          Open in Gmail
        </a>
        <a className="button-secondary" href={mailtoLink}>
          Open my email app
        </a>
        <button type="button" className="button-secondary" onClick={() => void handleCopy()}>
          {copyState === 'copied' ? 'Copied' : 'Copy message'}
        </button>
        {canShare && (
          <button type="button" className="button-secondary" onClick={() => void handleShare()}>
            Share…
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
