import { describe, expect, it } from 'vitest';
import { ABOUT_HREF, HOME_HREF, PRIVACY_HREF, TERMS_HREF, parsePublicRoute } from './publicRoute';

describe('parsePublicRoute', () => {
  it('opens the public pages for their links', () => {
    expect(parsePublicRoute(ABOUT_HREF)).toBe('about');
    expect(parsePublicRoute(PRIVACY_HREF)).toBe('privacy');
    expect(parsePublicRoute(TERMS_HREF)).toBe('terms');
  });

  it('shows the home screen for everything else, including sign-in error links', () => {
    expect(parsePublicRoute(HOME_HREF)).toBe('home');
    expect(parsePublicRoute('')).toBe('home');
    expect(parsePublicRoute('#main')).toBe('home');
    expect(parsePublicRoute('#error=access_denied&error_code=otp_expired')).toBe('home');
  });
});
