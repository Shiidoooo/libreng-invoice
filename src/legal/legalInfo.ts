/**
 * The facts the Privacy Policy and Terms of Use depend on, in one place. Update these
 * (and the "last updated" date) whenever the service, its providers or its contact change.
 */

/** Who runs the service. Shown as the party responsible for personal data. */
export const OPERATOR_NAME = 'Libreng Invoice';

/** Where users send privacy requests, questions and complaints. Must be a monitored inbox. */
export const CONTACT_EMAIL = 'librenginvoice@gmail.com';

/** Shown at the top of both pages. Change it whenever either page changes. */
export const LEGAL_LAST_UPDATED = 'November 13, 2026';

/**
 * Outside services that process personal data for the app. If one is added, removed or
 * moves region, update this list: users have a right to know where their data goes.
 */
export const SERVICE_PROVIDERS: { name: string; role: string; location: string }[] = [
  {
    name: 'Supabase',
    role: 'Sign-in and the database that stores your account, business details and documents',
    location: 'Australia (Sydney)',
  },
  {
    name: 'Vercel',
    role: 'Hosts the website and delivers its files to your browser',
    location: 'Global network (United States-based company)',
  },
  {
    name: 'Brevo',
    role: 'Delivers the emails you send to your customers from the app',
    location: 'European Union (France)',
  },
  {
    name: 'Google',
    role: 'Sign-in, only if you choose “Continue with Google”',
    location: 'United States and other countries',
  },
];
