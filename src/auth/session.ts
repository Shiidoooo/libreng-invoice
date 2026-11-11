import type { AuthError, EmailOtpType, Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { AppError, OFFLINE_MESSAGE } from '../errors/appError';
import { describeError, reportError } from '../errors/reportError';
import { requireSupabase } from '../storage/supabaseClient';

export type SessionState =
  | { status: 'loading' }
  /** `notice` explains a failed sign-in or email link, in our own words. */
  | { status: 'signed_out'; notice: string | null }
  | { status: 'signed_in'; session: Session }
  /** The user opened a password-reset link and must choose a new password before continuing. */
  | { status: 'recovering_password'; session: Session };

/** Supabase hashes passwords with bcrypt, which ignores anything past 72 bytes. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
export const EMAIL_MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A sign-in problem whose message is safe to show as-is. */
export class AuthFlowError extends AppError {}

/**
 * Set while the user must choose a new password, so a reload of that screen does not
 * skip it. Per tab (sessionStorage); cleared once the password changes or on sign-out.
 */
const RECOVERY_FLAG_KEY = 'libreng-invoice.recovering-password';

function setRecoveryFlag(isRecovering: boolean) {
  try {
    if (isRecovering) window.sessionStorage.setItem(RECOVERY_FLAG_KEY, '1');
    else window.sessionStorage.removeItem(RECOVERY_FLAG_KEY);
  } catch {
    // Storage blocked: a reload may then skip the new-password screen.
  }
}

function hasRecoveryFlag(): boolean {
  try {
    return window.sessionStorage.getItem(RECOVERY_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

const EMAIL_LINK_TYPES: readonly EmailOtpType[] = ['recovery', 'signup', 'email', 'invite', 'email_change', 'magiclink'];

function readUrlParams(): URLSearchParams {
  const params = new URLSearchParams(window.location.search);
  // Some auth redirects put their values after "#" instead of "?".
  new URLSearchParams(window.location.hash.slice(1)).forEach((value, key) => params.set(key, value));
  return params;
}

/** Removes auth values (codes, tokens, errors) from the address bar so they are not shared or bookmarked. */
function cleanAuthParamsFromUrl() {
  window.history.replaceState(null, '', window.location.pathname);
}

/** Fixed wording for errors Supabase reports in the URL; the URL's own text is never shown (it can be forged). */
function signInNoticeFromErrorCode(code: string | null): string {
  switch (code) {
    case 'otp_expired':
      return 'That link has expired or was already used. Please request a new one.';
    case 'access_denied':
      return 'Sign-in was cancelled. You can try again below.';
    default:
      return 'Sign-in did not finish. Please try again.';
  }
}

const PKCE_LINK_NOTICE =
  'That link could not be used here. Open it in the same browser where you asked for it, or request a new one and open it on this device.';

/**
 * Resolves what the page should show at start-up: handles email links in the
 * "token_hash" format (they work on any device), reports failed links, and keeps the
 * new-password step after a reload.
 */
async function resolveInitialSession(): Promise<SessionState> {
  const client = requireSupabase();
  const params = readUrlParams();
  const tokenHash = params.get('token_hash');
  const linkType = params.get('type') as EmailOtpType | null;

  if (tokenHash && linkType && EMAIL_LINK_TYPES.includes(linkType)) {
    cleanAuthParamsFromUrl();
    const { data, error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: linkType });
    if (error || !data.session) {
      return { status: 'signed_out', notice: signInNoticeFromErrorCode(error?.code ?? 'otp_expired') };
    }
    if (linkType === 'recovery') {
      setRecoveryFlag(true);
      return { status: 'recovering_password', session: data.session };
    }
    return { status: 'signed_in', session: data.session };
  }

  const { data } = await client.auth.getSession();
  if (data.session) {
    if (params.has('code')) cleanAuthParamsFromUrl();
    return hasRecoveryFlag()
      ? { status: 'recovering_password', session: data.session }
      : { status: 'signed_in', session: data.session };
  }

  let notice: string | null = null;
  if (params.has('error') || params.has('error_code') || params.has('error_description')) {
    notice = signInNoticeFromErrorCode(params.get('error_code'));
  } else if (params.has('code')) {
    // A PKCE link opened in another browser: the code cannot be exchanged here.
    notice = PKCE_LINK_NOTICE;
  }
  if (notice) cleanAuthParamsFromUrl();
  return { status: 'signed_out', notice };
}

/** Follows the Supabase session, including the redirect back from Google, email links and other tabs. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    let isActive = true;
    const client = requireSupabase();

    resolveInitialSession().then(
      (initial) => {
        if (!isActive) return;
        // A recovery event may already have arrived through the listener below; keep it.
        setState((current) => (current.status === 'recovering_password' ? current : initial));
      },
      (error: unknown) => {
        if (!isActive) return;
        setState({ status: 'signed_out', notice: describeError(error, 'check your sign-in', 'Could not check your sign-in.') });
      },
    );

    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (!session) {
        setRecoveryFlag(false);
        setState({ status: 'signed_out', notice: null });
      } else if (event === 'PASSWORD_RECOVERY') {
        setRecoveryFlag(true);
        setState({ status: 'recovering_password', session });
      } else if (event === 'USER_UPDATED') {
        setRecoveryFlag(false);
        setState({ status: 'signed_in', session });
      } else {
        setState((current) =>
          current.status === 'recovering_password' || hasRecoveryFlag()
            ? { status: 'recovering_password', session }
            : current.status === 'loading'
              ? current // resolveInitialSession decides the first screen
              : { status: 'signed_in', session },
        );
      }
    });

    return () => {
      isActive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}

export function validateEmail(email: string): string | null {
  const trimmed = email.trim();
  if (trimmed === '') return 'Enter your email address';
  if (trimmed.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email address';
  return null;
}

export function validateNewPassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters`;
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_LENGTH) return `Use at most ${PASSWORD_MAX_LENGTH} characters`;
  return null;
}

function toFriendlyError(error: AuthError, fallback: string): AuthFlowError {
  const options = { cause: error };
  switch (error.code) {
    // Same message for wrong password and unknown email, so the form doesn't reveal who has an account.
    case 'invalid_credentials':
      return new AuthFlowError('validation', 'Incorrect email or password.', options);
    case 'email_not_confirmed':
      return new AuthFlowError('validation', 'Please confirm your email first. Check your inbox for the confirmation link.', options);
    case 'weak_password':
      return new AuthFlowError('validation', 'That password is too easy to guess. Try a longer one, like a short phrase.', options);
    case 'same_password':
      return new AuthFlowError('validation', 'Choose a password different from your current one.', options);
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return new AuthFlowError('rate_limited', 'Too many attempts. Please wait a few minutes and try again.', options);
    default:
      if (error.status === 0 || error.message.includes('Failed to fetch')) {
        return new AuthFlowError('transient', OFFLINE_MESSAGE, options);
      }
      return new AuthFlowError('dependency', fallback, options);
  }
}

/** Redirects to Google; the browser comes back to this page signed in. */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await requireSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw toFriendlyError(error, 'Could not start Google sign-in. Please try again.');
}

export async function signInWithPassword(email: string, password: string): Promise<void> {
  const { error } = await requireSupabase().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw toFriendlyError(error, 'Could not sign in. Please try again.');
}

/**
 * Creates an account. Returns true when the user must confirm their email before signing in.
 * For an email that is already registered, Supabase answers the same way (without sending a
 * new account), so the form never reveals whether an address has an account.
 */
export async function signUpWithPassword(email: string, password: string): Promise<{ needsEmailConfirmation: boolean }> {
  const { data, error } = await requireSupabase().auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: window.location.origin },
  });
  if (error) throw toFriendlyError(error, 'Could not create the account. Please try again.');
  return { needsEmailConfirmation: data.session === null };
}

/** Sends a reset link. Always reports success so it does not reveal which emails have accounts. */
export async function requestPasswordReset(email: string): Promise<void> {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin,
  });
  if (error && (error.code === 'over_request_rate_limit' || error.code === 'over_email_send_rate_limit')) {
    throw toFriendlyError(error, '');
  }
  // Other failures are logged for developers but not shown, so the answer is the same for every email.
  if (error) reportError(toFriendlyError(error, 'Could not send the reset email.'), 'send a password reset email');
}

export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await requireSupabase().auth.updateUser({ password: newPassword });
  if (error) throw toFriendlyError(error, 'Could not change the password. Request a new reset link and try again.');
}

export async function signOut(): Promise<void> {
  await requireSupabase().auth.signOut({ scope: 'local' });
}

