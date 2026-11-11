/**
 * Splits every failure into two audiences:
 * - Customers get a plain message and, for unexpected failures, a short reference code.
 * - Developers get the full error in the browser console and a row in the
 *   `client_error_logs` table (readable only from the Supabase dashboard),
 *   keyed by the same reference code.
 */
import { requireSupabase } from '../storage/supabaseClient';
import { AppError } from './appError';

export interface ErrorReport {
  /** Safe to show to the customer. */
  message: string;
  /** Short code the customer can quote to support; null for expected errors. */
  reference: string | null;
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';
const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I look-alikes
const REFERENCE_LENGTH = 6;
const MAX_LOG_TEXT = 500;
const MAX_CONTEXT = 120;

function createReference(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(REFERENCE_LENGTH));
  return Array.from(bytes, (byte) => REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length]).join('');
}

/** The technical description of an error and its causes, for developers. */
function technicalDetail(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 4; depth += 1) {
    if (current instanceof Error) {
      const code = (current as { code?: unknown }).code;
      parts.push(`${current.name}${typeof code === 'string' ? `[${code}]` : ''}: ${current.message}`);
      current = current.cause;
    } else if (typeof current === 'object') {
      const { code, message } = current as { code?: unknown; message?: unknown };
      parts.push(`${typeof code === 'string' ? `[${code}] ` : ''}${typeof message === 'string' ? message : 'Unknown error object'}`);
      current = null;
    } else {
      parts.push(String(current));
      current = null;
    }
  }
  return parts.join(' <- ').slice(0, MAX_LOG_TEXT);
}

/** Best-effort upload of the developer log. Never throws and never reports its own failures. */
async function sendErrorLog(reference: string, kind: string, context: string, detail: string): Promise<void> {
  try {
    const client = requireSupabase();
    const { data } = await client.auth.getSession();
    if (!data.session) return; // Only signed-in users may write logs.
    await client.from('client_error_logs').insert({
      reference,
      kind,
      context: context.slice(0, MAX_CONTEXT),
      detail,
      // Path only: no query string or hash, which may carry tokens after a login redirect.
      page: window.location.pathname.slice(0, MAX_CONTEXT),
      user_agent: navigator.userAgent.slice(0, MAX_LOG_TEXT),
    });
  } catch {
    // Logging must never break the app.
  }
}

/**
 * Turns any thrown value into something safe to show, and logs unexpected ones.
 * `context` says what the user was doing, e.g. "save document".
 */
export function reportError(error: unknown, context: string, fallbackMessage = GENERIC_MESSAGE): ErrorReport {
  const appError = error instanceof AppError ? error : null;
  const message = appError?.userMessage ?? fallbackMessage;
  if (appError?.isExpected) return { message, reference: null };

  const reference = createReference();
  console.error(`[${reference}] Failed to ${context}`, error);
  void sendErrorLog(reference, appError?.kind ?? 'internal', context, technicalDetail(error));
  return { message, reference };
}

/** "Could not save. (Reference: K7Q2MX)" for places that show a single line of text. */
export function formatErrorReport(report: ErrorReport): string {
  return report.reference ? `${report.message} (Reference: ${report.reference})` : report.message;
}

/** Shorthand: report the error and get the text to display. */
export function describeError(error: unknown, context: string, fallbackMessage?: string): string {
  return formatErrorReport(reportError(error, context, fallbackMessage));
}

/** Catches errors nothing else handled, so they are still logged for developers. */
export function installGlobalErrorHandlers(): void {
  window.addEventListener('error', (event) => {
    reportError(event.error ?? event.message, 'run the page (uncaught error)');
  });
  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, 'finish a background task (unhandled promise)');
  });
}
