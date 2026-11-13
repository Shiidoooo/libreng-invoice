/**
 * Sends a document by email through the app's own email service (the
 * send-document-email function), for sellers who want it sent for them instead of
 * opening their email app. The seller is CC'd and set as Reply-To by the server.
 */
import { appConfig } from '../config/env';
import { AppError } from '../errors/appError';
import { requireSupabase } from '../storage/supabaseClient';
import type { EmailContent } from './emailMessage';

/** Uploading a PDF on mobile data can be slow, so this is longer than a normal request. */
const SEND_TIMEOUT_MS = 45_000;
const FUNCTION_PATH = '/functions/v1/send-document-email';

const UNREACHABLE_MESSAGE =
  'Could not reach the email service. Check your internet connection and try again. If it keeps happening, use “Share” or “Download” for now.';

/** Must match MAX_PDF_BASE64_LENGTH in supabase/functions/send-document-email. */
export const MAX_PDF_BASE64_LENGTH = 2_000_000;

export interface SentEmail {
  /** The seller's address that received the copy. */
  copySentTo: string;
}

/** Base64 without building one huge argument list, which fails for large files. */
export function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + CHUNK));
  }
  return btoa(binary);
}

/** Turns the function's error reply into a message the seller can act on. */
export function toSendError(status: number, code: string | null): AppError {
  if (code === 'RATE_LIMITED' || status === 429) {
    return new AppError(
      'rate_limited',
      'Today’s email limit has been reached. Try again tomorrow, or use “Open in Gmail” or “Share with PDF” for now.',
    );
  }
  if (code === 'EMAIL_NOT_CONFIRMED') {
    return new AppError('validation', 'Confirm your email address first: open the link we emailed you when you signed up.');
  }
  if (code === 'UNAUTHENTICATED' || status === 401) {
    return new AppError('unauthenticated', 'You are signed out. Sign in again, then send the email.');
  }
  if (code === 'INVALID_REQUEST' || status === 400) {
    return new AppError('validation', 'The email could not be sent. Check the address, subject and message, then try again.');
  }
  if (code === 'NOT_CONFIGURED' || status === 404 || status === 503) {
    return new AppError('dependency', 'Sending from the app is not available right now. Use “Open in Gmail” or “Share with PDF” instead.');
  }
  return new AppError('dependency', 'The email could not be sent. Please try again in a moment.');
}

export async function sendDocumentEmail(email: EmailContent, pdf: File): Promise<SentEmail> {
  if (!appConfig.isValid) throw new AppError('internal', 'The app is not configured.');
  const { data } = await requireSupabase().auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw toSendError(401, 'UNAUTHENTICATED');

  const pdfBase64 = bytesToBase64(new Uint8Array(await pdf.arrayBuffer()));
  if (pdfBase64.length > MAX_PDF_BASE64_LENGTH) {
    throw new AppError('validation', 'This PDF is too large to email from the app. Download it and attach it yourself instead.');
  }

  let response: Response;
  try {
    response = await fetch(`${appConfig.config.supabaseUrl}${FUNCTION_PATH}`, {
      method: 'POST',
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: appConfig.config.supabasePublishableKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: email.to.trim(),
        subject: email.subject.trim(),
        message: email.message.trim(),
        fileName: pdf.name,
        pdfBase64,
      }),
    });
  } catch (error) {
    // The browser reports a refused cross-site request the same way as being offline, so
    // mention both: a site address missing from ALLOWED_ORIGINS looks exactly like this.
    throw new AppError('transient', UNREACHABLE_MESSAGE, { cause: error });
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = (body as { error?: { code?: unknown } } | null)?.error?.code;
    throw toSendError(response.status, typeof code === 'string' ? code : null);
  }
  const copySentTo = (body as { data?: { copySentTo?: unknown } } | null)?.data?.copySentTo;
  return { copySentTo: typeof copySentTo === 'string' ? copySentTo : '' };
}
