import { useState, type FormEvent } from 'react';
import { FormField } from '../ui/FormField';
import {
  AuthFlowError,
  EMAIL_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  requestPasswordReset,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
  takeSignInErrorFromUrl,
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

export function SignInPage() {
  const [mode, setMode] = useState<Mode>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; confirmPassword?: string }>({});
  const [feedback, setFeedback] = useState<Feedback>(() => {
    const urlError = takeSignInErrorFromUrl();
    return urlError ? { tone: 'error', message: `Sign-in failed: ${urlError}` } : null;
  });
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
      setFeedback({ tone: 'error', message: error instanceof AuthFlowError ? error.message : 'Something went wrong. Please try again.' });
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
      setFeedback({ tone: 'error', message: error instanceof AuthFlowError ? error.message : 'Could not start Google sign-in.' });
      setIsBusy(false);
    }
  };

  const submitLabel = {
    sign_in: isBusy ? 'Signing in…' : 'Sign in',
    sign_up: isBusy ? 'Creating account…' : 'Create account',
    forgot_password: isBusy ? 'Sending…' : 'Send reset link',
  }[mode];

  return (
    <main id="main" className="sign-in">
      <section className="card sign-in-card">
        <div>
          <p className="sign-in-title">Libreng Invoice</p>
          <p className="field-hint">Free invoices, quotations and receipts for small businesses and freelancers.</p>
        </div>
        <h1 className="sign-in-heading">{MODE_TITLES[mode]}</h1>

        {mode !== 'forgot_password' && (
          <>
            <button type="button" className="button-secondary sign-in-button" disabled={isBusy} onClick={() => void handleGoogle()}>
              Continue with Google
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
      </section>
    </main>
  );
}
