import { describe, expect, it } from 'vitest';
import { validateEmail, validateNewPassword } from './session';

describe('validateEmail', () => {
  it('accepts a normal address', () => {
    expect(validateEmail(' juan@example.com ')).toBeNull();
  });

  it.each(['', 'juan', 'juan@', 'juan@example', 'ju an@example.com'])('rejects %j', (email) => {
    expect(validateEmail(email)).not.toBeNull();
  });
});

describe('validateNewPassword', () => {
  it('requires at least 8 characters', () => {
    expect(validateNewPassword('1234567')).not.toBeNull();
    expect(validateNewPassword('12345678')).toBeNull();
  });

  it('allows a long passphrase up to the 72-byte bcrypt limit', () => {
    expect(validateNewPassword('a'.repeat(72))).toBeNull();
    expect(validateNewPassword('a'.repeat(73))).not.toBeNull();
  });

  it('counts bytes, not characters, for non-ASCII text', () => {
    // "ñ" is 2 bytes in UTF-8: 37 × 2 = 74 bytes.
    expect(validateNewPassword('ñ'.repeat(37))).not.toBeNull();
  });
});
