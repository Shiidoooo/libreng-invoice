import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { appConfig } from '../config/env';

/** Requests that take longer than this fail instead of hanging the screen. */
const REQUEST_TIMEOUT_MS = 15_000;

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
  return fetch(input, { ...init, signal });
}

/** Null when configuration is invalid; App shows the configuration problem instead. */
export const supabase: SupabaseClient | null = appConfig.isValid
  ? createClient(appConfig.config.supabaseUrl, appConfig.config.supabasePublishableKey, {
      auth: {
        // PKCE: the OAuth redirect carries a one-time code, never the tokens themselves.
        flowType: 'pkce',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: { fetch: fetchWithTimeout },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) throw new Error('The app is not configured. See the setup message.');
  return supabase;
}
