import type { AuthError, Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { AppError, OFFLINE_MESSAGE } from '../errors/appError';
import { reportError } from '../errors/reportError';
import { requireSupabase } from '../storage/supabaseClient';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed_out' }
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

/** Follows the Supabase session, including the redirect back from Google, reset links and other tabs. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    const client = requireSupabase();
    client.auth.getSession().then(
      ({ data }) =>
        setState((current) =>
          // A recovery event may already have arrived; don't overwrite it.
          current.status === 'recovering_password'
            ? current
            : data.session
              ? { status: 'signed_in', session: data.session }
              : { status: 'signed_out' },
        ),
      () => setState({ status: 'signed_out' }),
    );
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (!session) {
        setState({ status: 'signed_out' });
      } else if (event === 'PASSWORD_RECOVERY') {
        setState({ status: 'recovering_password', session });
      } else {
        setState((current) =>
          current.status === 'recovering_password' && event !== 'USER_UPDATED'
            ? { status: 'recovering_password', session }
            : { status: 'signed_in', session },
        );
      }
    });
    return () => data.subscription.unsubscribe();
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

/** Reads a failed-login message that Supabase puts in the URL after a redirect, then cleans the URL. */
export function takeSignInErrorFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search || window.location.hash.slice(1));
  const description = params.get('error_description');
  if (!description) return null;
  window.history.replaceState(null, '', window.location.pathname);
  return description.slice(0, 200);
}
