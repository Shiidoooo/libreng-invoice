import { useState, type FormEvent } from 'react';
import { describeError } from '../errors/reportError';
import { FormField } from '../ui/FormField';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, signOut, updatePassword, validateNewPassword } from './session';

/** Shown after the user opens a password-reset link from their email. */
export function ResetPasswordPage({ email }: { email: string }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string; form?: string }>({});
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    const passwordError = validateNewPassword(password);
    if (passwordError) next.password = passwordError;
    if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setIsSaving(true);
    try {
      await updatePassword(password);
      // The session listener moves on to the app once the password is updated.
    } catch (error) {
      setErrors({ form: describeError(error, 'set a new password', 'Could not change the password. Please try again.') });
      setIsSaving(false);
    }
  };

  return (
    <main id="main" className="sign-in">
      <section className="card sign-in-card">
        <h1 className="sign-in-heading">Choose a new password</h1>
        <p className="field-hint">For {email}</p>
        <form className="sign-in-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
          <FormField label="New password" isRequired error={errors.password} hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}>
            {(control) => (
              <input
                {...control}
                type="password"
                autoComplete="new-password"
                maxLength={PASSWORD_MAX_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </FormField>
          <FormField label="Confirm new password" isRequired error={errors.confirmPassword}>
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
          <button type="submit" className="button-primary sign-in-button" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save new password'}
          </button>
        </form>
        <div role="status" aria-live="polite">
          {errors.form && <p className="banner banner-error">{errors.form}</p>}
        </div>
        <button type="button" className="link-button" onClick={() => void signOut()}>
          Cancel and sign out
        </button>
      </section>
    </main>
  );
}
