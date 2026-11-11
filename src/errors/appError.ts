/**
 * One error type for everything the app shows to customers.
 *
 * - `userMessage` is always safe to display: no SQL, stack traces or internals.
 * - `kind` classifies the failure. Expected kinds (the user can fix them, e.g. a
 *   duplicate number) are shown as-is; unexpected kinds also get a reference code
 *   and a developer log entry (see reportError.ts).
 * - The original error goes in `cause`, for developers only.
 */
export type ErrorKind =
  | 'validation'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'rate_limited'
  | 'dependency'
  | 'transient'
  | 'internal';

const EXPECTED_KINDS: ReadonlySet<ErrorKind> = new Set(['validation', 'unauthenticated', 'not_found', 'conflict', 'rate_limited']);

export class AppError extends Error {
  readonly kind: ErrorKind;
  readonly userMessage: string;

  constructor(kind: ErrorKind, userMessage: string, options?: { cause?: unknown }) {
    super(userMessage, options);
    this.name = 'AppError';
    this.kind = kind;
    this.userMessage = userMessage;
  }

  /** True when the user caused it and can fix it, so no developer report is needed. */
  get isExpected(): boolean {
    return EXPECTED_KINDS.has(this.kind);
  }
}

export const RATE_LIMITED_MESSAGE = 'You are going a bit too fast. Please wait a minute, then try again.';
export const OFFLINE_MESSAGE = 'Could not reach the server. Check your internet connection and try again.';
