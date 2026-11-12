import { describe, expect, it } from 'vitest';
import { ABOUT_HREF, SIGN_IN_HREF, parsePublicRoute } from './publicRoute';

describe('parsePublicRoute', () => {
  it('opens the About page for its link', () => {
    expect(parsePublicRoute(ABOUT_HREF)).toBe('about');
  });

  it('shows sign-in for everything else, including sign-in error links', () => {
    expect(parsePublicRoute(SIGN_IN_HREF)).toBe('sign_in');
    expect(parsePublicRoute('')).toBe('sign_in');
    expect(parsePublicRoute('#error=access_denied&error_code=otp_expired')).toBe('sign_in');
  });
});
