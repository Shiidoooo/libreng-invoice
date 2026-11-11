import { useId, type ReactNode } from 'react';

interface FieldRenderProps {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby': string | undefined;
}

interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  isRequired?: boolean;
  className?: string;
  /** Receives the props that tie the control to its label, hint and error. */
  children: (control: FieldRenderProps) => ReactNode;
}

/** A labelled control with its hint and error text linked for screen readers. */
export function FormField({ label, error, hint, isRequired = false, className, children }: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={['field', className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className="field-label">
        {label}
        {isRequired && (
          <span className="field-required" aria-hidden="true">
            {' '}*
          </span>
        )}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
