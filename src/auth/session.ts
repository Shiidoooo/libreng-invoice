import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { requireSupabase } from '../storage/supabaseClient';

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; session: Session };

/** Follows the Supabase session, including the redirect back from Google and sign-outs in other tabs. */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading' });

  useEffect(() => {
    const client = requireSupabase();
    const apply = (session: Session | null) =>
      setState(session ? { status: 'signed_in', session } : { status: 'signed_out' });

    client.auth.getSession().then(
      ({ data }) => apply(data.session),
      () => apply(null),
    );
    const { data } = client.auth.onAuthStateChange((_event, session) => apply(session));
    return () => data.subscription.unsubscribe();
  }, []);

  return state;
}

/** Redirects to Google; the browser comes back to this page signed in. */
export async function signInWithGoogle(): Promise<void> {
  const { error } = await requireSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } },
  });
  if (error) throw new Error('Could not start Google sign-in. Please try again.');
}

export async function signOut(): Promise<void> {
  await requireSupabase().auth.signOut({ scope: 'local' });
}

/** Reads a failed-login message that Supabase puts in the URL after the Google redirect, then cleans the URL. */
export function takeSignInErrorFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search || window.location.hash.slice(1));
  const description = params.get('error_description');
  if (!description) return null;
  window.history.replaceState(null, '', window.location.pathname);
  return description.slice(0, 200);
}
