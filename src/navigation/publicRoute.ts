import { useSyncExternalStore } from 'react';

/**
 * Pages that can be opened by link. The route lives in the URL hash ("#/about") so pages
 * can be linked to and the browser's Back button works, without the host needing any
 * rewrite rules. About, Privacy and Terms are public: they can be read signed in or not.
 */
export type PublicRoute = 'home' | 'about' | 'privacy' | 'terms';

export const HOME_HREF = '#/';
export const ABOUT_HREF = '#/about';
export const PRIVACY_HREF = '#/privacy';
export const TERMS_HREF = '#/terms';

const ROUTES: Record<string, PublicRoute> = {
  [ABOUT_HREF]: 'about',
  [PRIVACY_HREF]: 'privacy',
  [TERMS_HREF]: 'terms',
};

export function parsePublicRoute(hash: string): PublicRoute {
  return ROUTES[hash] ?? 'home';
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function usePublicRoute(): PublicRoute {
  return useSyncExternalStore(subscribe, () => parsePublicRoute(window.location.hash));
}
