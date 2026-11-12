import { useSyncExternalStore } from 'react';

/**
 * The pages a signed-out visitor can open. The route lives in the URL hash ("#/about")
 * so the About page can be linked to and the browser's Back button works, without the
 * host needing any rewrite rules.
 */
export type PublicRoute = 'sign_in' | 'about';

export const ABOUT_HREF = '#/about';
export const SIGN_IN_HREF = '#/';

export function parsePublicRoute(hash: string): PublicRoute {
  return hash === ABOUT_HREF ? 'about' : 'sign_in';
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function usePublicRoute(): PublicRoute {
  return useSyncExternalStore(subscribe, () => parsePublicRoute(window.location.hash));
}
