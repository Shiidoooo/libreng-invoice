import { SIGN_IN_HREF } from '../navigation/publicRoute';
import { AboutPage } from './AboutPage';

/** The About page for visitors who are not signed in, with its own small header. */
export function PublicAboutPage() {
  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="app-header">
        <a className="app-logo" href={SIGN_IN_HREF}>
          <span className="app-logo-mark" aria-hidden="true">
            ₱
          </span>
          Libreng Invoice
        </a>
        <div className="app-account">
          <a className="button-primary" href={SIGN_IN_HREF}>
            Sign in
          </a>
        </div>
      </header>
      <main id="main" className="about-main">
        <AboutPage
          callToAction={
            <a className="button-primary button-large" href={SIGN_IN_HREF}>
              Start making documents
            </a>
          }
        />
      </main>
    </div>
  );
}
