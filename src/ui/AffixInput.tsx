import type { InputHTMLAttributes } from 'react';

interface AffixInputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Short text shown inside the field before the value, e.g. "₱". */
  prefix?: string;
  /** Short text shown inside the field after the value, e.g. "%". */
  suffix?: string;
}

/** An input with a fixed symbol inside it. The symbol is decorative; the field's label carries the meaning. */
export function AffixInput({ prefix, suffix, className, ...inputProps }: AffixInputProps) {
  return (
    <div className={['input-affix', className].filter(Boolean).join(' ')}>
      {prefix && (
        <span className="input-affix-text" aria-hidden="true">
          {prefix}
        </span>
      )}
      <input {...inputProps} />
      {suffix && (
        <span className="input-affix-text" aria-hidden="true">
          {suffix}
        </span>
      )}
    </div>
  );
}
