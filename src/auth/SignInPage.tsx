import { useState } from 'react';
import { signInWithGoogle, takeSignInErrorFromUrl } from './session';

export function SignInPage() {
  const [error, setError] = useState<string | null>(() => takeSignInErrorFromUrl());
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setIsRedirecting(true);
    try {
      await signInWithGoogle();
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Could not start Google sign-in.');
      setIsRedirecting(false);
    }
  };

  return (
    <main id="main" className="sign-in">
      <section className="card sign-in-card">
        <h1 className="sign-in-title">Libreng Invoice</h1>
        <p>Free invoices, quotations and receipts for small businesses and freelancers.</p>
        <ul className="sign-in-points">
          <li>Your records are saved securely in your account</li>
          <li>Open them on your phone or computer</li>
          <li>No subscription, no hidden download fees</li>
        </ul>
        <button type="button" className="button-primary sign-in-button" disabled={isRedirecting} onClick={() => void handleSignIn()}>
          {isRedirecting ? 'Opening Google…' : 'Continue with Google'}
        </button>
        <div role="status" aria-live="polite">
          {error && <p className="banner banner-error">Sign-in failed: {error}</p>}
        </div>
      </section>
    </main>
  );
}
