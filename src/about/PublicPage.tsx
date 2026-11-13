import { useEffect, useRef } from 'react';
import { PrivacyPolicy } from '../legal/PrivacyPolicy';
import { TermsOfUse } from '../legal/TermsOfUse';
import { ABOUT_HREF, HOME_HREF, PRIVACY_HREF, TERMS_HREF, type PublicRoute } from '../navigation/publicRoute';
import { AboutPage } from './AboutPage';

interface PublicPageProps {
  route: Exclude<PublicRoute, 'home'>;
  /** Signed-in readers get a way back to the app instead of a Sign in button. */
  isSignedIn: boolean;
}

/** About, Privacy Policy and Terms of Use, readable whether or not you are signed in. */
export function PublicPage({ route, isSignedIn }: PublicPageProps) {
  const mainRef = useRef<HTMLElement>(null);
  const homeLabel = isSignedIn ? 'Back to the app' : 'Sign in';

  // A new page starts at the top, not where the previous one was scrolled to.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  return (
    <div className="app-shell">
      {/* Moves focus without changing the address, which would change the page. */}
      <a
        href="#main"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault();
          mainRef.current?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="app-header">
        <a className="app-logo" href={HOME_HREF}>
          <span className="app-logo-mark" aria-hidden="true">
            ₱
          </span>
          Libreng Invoice
        </a>
        <div className="app-account">
          <a className="button-primary" href={HOME_HREF}>
            {homeLabel}
          </a>
        </div>
      </header>
      <main id="main" ref={mainRef} tabIndex={-1} className="about-main">
        {route === 'about' && (
          <AboutPage
            callToAction={
              <a className="button-primary button-large" href={HOME_HREF}>
                {isSignedIn ? 'Back to the app' : 'Start making documents'}
              </a>
            }
          />
        )}
        {route === 'privacy' && <PrivacyPolicy />}
        {route === 'terms' && <TermsOfUse />}
      </main>
      <LegalLinks className="public-footer" />
    </div>
  );
}

/** Links to About, Privacy Policy and Terms of Use, used in every footer. */
export function LegalLinks({ className, isNewTab = false }: { className?: string; isNewTab?: boolean }) {
  // Inside the app, the pages open in a new tab so unsaved work is never left behind.
  const linkProps = isNewTab ? { target: '_blank', rel: 'noopener noreferrer' } : {};
  return (
    <nav aria-label="About and legal" className={['legal-links', className].filter(Boolean).join(' ')}>
      <a href={ABOUT_HREF} {...linkProps}>
        About
      </a>
      <a href={PRIVACY_HREF} {...linkProps}>
        Privacy Policy
      </a>
      <a href={TERMS_HREF} {...linkProps}>
        Terms of Use
      </a>
    </nav>
  );
}
