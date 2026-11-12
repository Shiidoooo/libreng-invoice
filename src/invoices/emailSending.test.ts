import { describe, expect, it } from 'vitest';
import { bytesToBase64, toSendError } from './emailSending';

describe('bytesToBase64', () => {
  it('encodes bytes, including a PDF header', () => {
    expect(bytesToBase64(new TextEncoder().encode('%PDF-1.3'))).toBe('JVBERi0xLjM=');
    expect(bytesToBase64(new Uint8Array([]))).toBe('');
  });

  it('handles files larger than one chunk without losing bytes', () => {
    const bytes = new Uint8Array(100_000).map((_, index) => index % 251);
    const decoded = Uint8Array.from(atob(bytesToBase64(bytes)), (character) => character.charCodeAt(0));
    expect(decoded).toEqual(bytes);
  });
});

describe('toSendError', () => {
  it('explains the daily limit and points to the other ways of sending', () => {
    const error = toSendError(429, 'RATE_LIMITED');
    expect(error.kind).toBe('rate_limited');
    expect(error.userMessage).toContain('Open in Gmail');
  });

  it('asks unconfirmed accounts to confirm their email', () => {
    expect(toSendError(403, 'EMAIL_NOT_CONFIRMED').userMessage).toContain('Confirm your email');
  });

  it('treats a missing or unconfigured function as unavailable, not as the user’s mistake', () => {
    expect(toSendError(404, null).kind).toBe('dependency');
    expect(toSendError(503, 'NOT_CONFIGURED').kind).toBe('dependency');
  });

  it('asks signed-out users to sign in again', () => {
    expect(toSendError(401, null).kind).toBe('unauthenticated');
  });

  it('falls back to a retry message for provider failures', () => {
    expect(toSendError(502, 'EMAIL_PROVIDER_FAILED').userMessage).toContain('try again');
  });
});
