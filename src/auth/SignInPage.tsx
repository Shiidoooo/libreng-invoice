import { useState, type FormEvent } from 'react';
import { describeError } from '../errors/reportError';
import { FormField } from '../ui/FormField';
import { GoogleMark } from '../ui/icons';
import { ABOUT_HREF } from '../navigation/publicRoute';
import {
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  requestPasswordReset,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
  validateEmail,
  validateNewPassword,
} from './session';

type Mode = 'sign_in' | 'sign_up' | 'forgot_password';

const MODE_TITLES: Record<Mode, string> = {
  sign_in: 'Sign in',
  sign_up: 'Create an account',
  forgot_password: 'Reset your password',
};

type Feedback = { tone: 'success' | 'error'; message: string } | null;

/** `notice` explains why the user landed here, e.g. an expired email link. */
export function SignInPage({ notice }: { notice: string | null }) {
  const [mode, setMode] = useState<Mode>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
  const [feedback, setFeedback] = useState<Feedback>(notice ? { tone: 'error', message: notice } : null);
  const [isBusy, setIsBusy] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setPassword('');
    setConfirmPassword('');
    setFieldErrors({});
    setFeedback(null);
  };

  const validate = () => {
    const errors: typeof fieldErrors = {};
    const emailError = validateEmail(email);
    if (emailError) errors.email = emailError;
    if (mode === 'sign_in' && password === '') errors.password = 'Enter your password';
    if (mode === 'sign_up') {
      const passwordError = validateNewPassword(password);
      if (passwordError) errors.password = passwordError;
      if (confirmPassword !== password) errors.confirmPassword = 'Passwords do not match';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    if (!validate()) return;
    setIsBusy(true);
    try {
      if (mode === 'sign_in') {
        await signInWithPassword(email, password);
        return; // The session listener switches to the app.
      }
      if (mode === 'sign_up') {
        const { needsEmailConfirmation } = await signUpWithPassword(email, password);
        if (needsEmailConfirmation) {
          switchMode('sign_in');
          setFeedback({
            tone: 'success',
            message: `Almost done! If ${email.trim()} can be registered, we sent a confirmation link to it. Open it, then sign in.`,
          });
        }
        return;
      }
      await requestPasswordReset(email);
      setFeedback({
        tone: 'success',
        message: `If an account exists for ${email.trim()}, a reset link is on its way. Check your inbox and spam folder.`,
      });
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error, `${mode.replace('_', ' ')} with email`) });
    } finally {
      setIsBusy(false);
    }
  };

  const handleGoogle = async () => {
    setFeedback(null);
    setIsBusy(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      setFeedback({ tone: 'error', message: describeError(error, 'start Google sign-in', 'Could not start Google sign-in.') });
      setIsBusy(false);
    }
  };

  const submitLabel = {
    sign_in: isBusy ? 'Signing in…' : 'Sign in',
    sign_up: isBusy ? 'Creating account…' : 'Create account',
    forgot_password: isBusy ? 'Sending…' : 'Send reset link',
  }[mode];

  return (
    <main id="main" className="auth">
      <section className="auth-pitch" aria-label="What Libreng Invoice is">
        <p className="app-logo">
          <span className="app-logo-mark" aria-hidden="true">
            ₱
          </span>
          Libreng Invoice
        </p>
        <h1 className="auth-headline">
          Invoices and receipts for your business. <mark>Libre.</mark>
        </h1>
        <p className="auth-lead">
          Make an invoice, quotation or receipt in a minute, then print it or send it as a PDF. Made for sari-sari
          stores, small shops and freelancers.
        </p>
        <ul className="auth-points">
          <li>No subscription, no watermark, no fee for the PDF</li>
          <li>Price per piece, per kilo or per hour</li>
          <li>Works on your phone</li>
        </ul>
        <SampleSlip />
        <a className="auth-about-link" href={ABOUT_HREF}>
          How it works and how your data is kept <span aria-hidden="true">→</span>
        </a>
      </section>

      <section className="auth-panel" aria-labelledby="sign-in-heading">
        <div className="card sign-in-card">
        <h2 id="sign-in-heading" className="sign-in-heading">
          {MODE_TITLES[mode]}
        </h2>

        {mode !== 'forgot_password' && (
          <>
            <button type="button" className="button-google sign-in-button" disabled={isBusy} onClick={() => void handleGoogle()}>
              <GoogleMark /> Continue with Google
            </button>
            <p className="sign-in-divider">
              <span>or use your email</span>
            </p>
          </>
        )}

        <form className="sign-in-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
          <FormField label="Email" isRequired error={fieldErrors.email}>
            {(control) => (
              <input
                {...control}
                type="email"
                autoComplete="email"
                maxLength={EMAIL_MAX_LENGTH}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            )}
          </FormField>
          {mode !== 'forgot_password' && (
            <FormField
              label="Password"
              isRequired
              error={fieldErrors.password}
              hint={mode === 'sign_up' ? `At least ${PASSWORD_MIN_LENGTH} characters. A short phrase works well.` : undefined}
            >
              {(control) => (
                <input
                  {...control}
                  type="password"
                  autoComplete={mode === 'sign_up' ? 'new-password' : 'current-password'}
                  maxLength={PASSWORD_MAX_LENGTH}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </FormField>
          )}
          {mode === 'sign_up' && (
            <FormField label="Confirm password" isRequired error={fieldErrors.confirmPassword}>
              {(control) => (
                <input
                  {...control}
                  type="password"
                  autoComplete="new-password"
                  maxLength={PASSWORD_MAX_LENGTH}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              )}
            </FormField>
          )}
          <button type="submit" className="button-primary sign-in-button" disabled={isBusy}>
            {submitLabel}
          </button>
        </form>

        <div role="status" aria-live="polite">
          {feedback && <p className={`banner banner-${feedback.tone}`}>{feedback.message}</p>}
        </div>

        <div className="sign-in-links">
          {mode === 'sign_in' && (
            <>
              <button type="button" className="link-button" onClick={() => switchMode('forgot_password')}>
                Forgot password?
              </button>
              <button type="button" className="link-button" onClick={() => switchMode('sign_up')}>
                Create an account
              </button>
            </>
          )}
          {mode !== 'sign_in' && (
            <button type="button" className="link-button" onClick={() => switchMode('sign_in')}>
              Back to sign in
            </button>
          )}
        </div>
        </div>
      </section>
    </main>
  );
}

/** A small sample receipt, purely decorative, so the page shows what the app makes. */
function SampleSlip() {
  return (
    <div className="slip" aria-hidden="true">
      <div className="slip-head">
        <span className="slip-store">Aling Nena Store</span>
        <span className="slip-number">No. 0012</span>
      </div>
      <ul className="slip-lines">
        <li>
          <span>Bigas, 25 kg</span>
          <span>₱1,375.00</span>
        </li>
        <li>
          <span>Itlog, 2 tray</span>
          <span>₱480.00</span>
        </li>
        <li>
          <span>Delivery</span>
          <span>₱80.00</span>
        </li>
      </ul>
      <div className="slip-total">
        <span>Total</span>
        <strong>₱1,935.00</strong>
      </div>
      <span className="slip-stamp">Paid</span>
    </div>
  );
}
