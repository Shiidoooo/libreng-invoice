import { describe, expect, it } from 'vitest';
import { DuplicateNumberError, toStorageError } from './database';

const postgrestError = (code: string, message = 'details') => Object.assign(new Error(message), { code, details: '', hint: '' });

describe('toStorageError', () => {
  it.each([
    ['23505', 'conflict'],
    ['PT429', 'rate_limited'],
    ['PT422', 'validation'],
    ['23514', 'validation'],
    ['42501', 'forbidden'],
    ['PGRST301', 'unauthenticated'],
    ['XX000', 'dependency'],
  ])('maps %s to %s', (code, kind) => {
    expect(toStorageError(postgrestError(code), 'save INV-1').kind).toBe(kind);
  });

  it('uses a dedicated class for duplicate numbers', () => {
    expect(toStorageError(postgrestError('23505'), 'save INV-1')).toBeInstanceOf(DuplicateNumberError);
  });

  it.each(['TypeError: Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed', 'TimeoutError: signal timed out'])(
    'treats %j as a connection problem in every browser',
    (message) => {
      expect(toStorageError(postgrestError('', message), 'save INV-1').kind).toBe('transient');
    },
  );

  it('never shows the raw database message to customers', () => {
    const error = toStorageError(postgrestError('XX000', 'relation "documents" secret detail'), 'save INV-1');
    expect(error.userMessage).not.toMatch(/relation|secret/);
  });
});
