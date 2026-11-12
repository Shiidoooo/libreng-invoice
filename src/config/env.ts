/** Reads and validates build-time configuration once, at startup. */

export interface AppConfig {
  supabaseUrl: string;
  supabasePublishableKey: string;
  /** True once the send-document-email function is deployed (VITE_ENABLE_EMAIL_SENDING=true). */
  isEmailSendingEnabled: boolean;
}

export type ConfigResult = { isValid: true; config: AppConfig } | { isValid: false; problems: string[] };

const SUPABASE_URL_PATTERN = /^https:\/\/[a-z0-9]{20}\.supabase\.co$/;
const PUBLISHABLE_KEY_PATTERN = /^(sb_publishable_[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

/**
 * Legacy Supabase keys are JWTs. Only the "anon" one is public; a "service_role" key
 * bypasses all security rules and must never reach the browser bundle.
 */
function isNonAnonymousJwt(key: string): boolean {
  if (!key.startsWith('eyJ')) return false;
  try {
    const payloadPart = key.split('.')[1] ?? '';
    const payload: unknown = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')));
    return !(typeof payload === 'object' && payload !== null && (payload as { role?: unknown }).role === 'anon');
  } catch {
    return true; // Unreadable: treat as unsafe.
  }
}

export function readConfig(env: Record<string, string | undefined>): ConfigResult {
  const problems: string[] = [];
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim().replace(/\/+$/, '') ?? '';
  const supabasePublishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

  if (!SUPABASE_URL_PATTERN.test(supabaseUrl)) {
    problems.push('VITE_SUPABASE_URL is missing or not a https://<project-id>.supabase.co address.');
  }
  if (!PUBLISHABLE_KEY_PATTERN.test(supabasePublishableKey)) {
    problems.push('VITE_SUPABASE_PUBLISHABLE_KEY is missing or not a Supabase publishable key.');
  }
  if (supabasePublishableKey.startsWith('sb_secret_') || isNonAnonymousJwt(supabasePublishableKey)) {
    problems.push('VITE_SUPABASE_PUBLISHABLE_KEY holds a SECRET key. Remove it and rotate it in Supabase.');
  }

  return problems.length > 0
    ? { isValid: false, problems }
    : {
        isValid: true,
        config: { supabaseUrl, supabasePublishableKey, isEmailSendingEnabled: env.VITE_ENABLE_EMAIL_SENDING === 'true' },
      };
}

export const appConfig = readConfig(import.meta.env);
