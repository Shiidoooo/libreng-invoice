import { describe, expect, it } from 'vitest';
import { readConfig } from './env';

const VALID = {
  VITE_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
};

describe('readConfig', () => {
  it('accepts a valid URL and publishable key', () => {
    expect(readConfig(VALID)).toEqual({
      isValid: true,
      config: { supabaseUrl: VALID.VITE_SUPABASE_URL, supabasePublishableKey: VALID.VITE_SUPABASE_PUBLISHABLE_KEY },
    });
  });

  it('fails fast when values are missing', () => {
    const result = readConfig({});
    expect(result.isValid).toBe(false);
    expect(!result.isValid && result.problems).toHaveLength(2);
  });

  it('rejects a non-Supabase or plain-http URL', () => {
    expect(readConfig({ ...VALID, VITE_SUPABASE_URL: 'http://abcdefghijklmnopqrst.supabase.co' }).isValid).toBe(false);
    expect(readConfig({ ...VALID, VITE_SUPABASE_URL: 'https://evil.example.com' }).isValid).toBe(false);
  });

  it('refuses a secret key placed in the public bundle', () => {
    const result = readConfig({ ...VALID, VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abcdefghijklmnopqrstuvwxyz' });
    expect(!result.isValid && result.problems.join(' ')).toMatch(/SECRET key/);
  });
});

describe('readConfig legacy JWT keys', () => {
  const jwt = (payload: object) => `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify(payload)).replace(/=+$/, '')}.c2lnbmF0dXJl`;

  it('accepts a legacy anon key', () => {
    expect(readConfig({ ...VALID, VITE_SUPABASE_PUBLISHABLE_KEY: jwt({ role: 'anon' }) }).isValid).toBe(true);
  });

  it('refuses a legacy service_role key', () => {
    const result = readConfig({ ...VALID, VITE_SUPABASE_PUBLISHABLE_KEY: jwt({ role: 'service_role' }) });
    expect(!result.isValid && result.problems.join(' ')).toMatch(/SECRET key/);
  });
});
