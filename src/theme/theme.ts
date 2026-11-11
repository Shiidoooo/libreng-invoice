import { useSyncExternalStore } from 'react';

/** "system" follows the phone or computer setting. */
export type ThemePreference = 'system' | 'light' | 'dark';

/** Keep in sync with public/theme-init.js. */
const STORAGE_KEY = 'libreng-invoice.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

const listeners = new Set<() => void>();

function readStoredPreference(): ThemePreference {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

let currentPreference: ThemePreference = readStoredPreference();

function applyToDocument(preference: ThemePreference) {
  if (preference === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', preference);
}

export function setThemePreference(preference: ThemePreference) {
  currentPreference = preference;
  applyToDocument(preference);
  try {
    if (preference === 'system') window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    // Storage blocked: the choice still applies until the page is closed.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = window.matchMedia(DARK_QUERY);
  media.addEventListener('change', listener);
  return () => {
    listeners.delete(listener);
    media.removeEventListener('change', listener);
  };
}

/** The saved choice plus what is actually showing ("system" resolved to light or dark). */
export function useTheme(): { preference: ThemePreference; resolved: 'light' | 'dark' } {
  const preference = useSyncExternalStore(subscribe, () => currentPreference);
  const isSystemDark = useSyncExternalStore(subscribe, () => window.matchMedia(DARK_QUERY).matches);
  const resolved = preference === 'system' ? (isSystemDark ? 'dark' : 'light') : preference;
  return { preference, resolved };
}
