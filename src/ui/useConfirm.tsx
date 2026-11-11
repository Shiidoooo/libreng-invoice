import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Modal } from './Modal';

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  /** Say what happens, e.g. "Delete invoice", never just "OK". */
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

/**
 * In-app replacement for window.confirm().
 * Render `confirmDialog` once, then `if (await confirm({...})) { ... }`.
 */
export function useConfirm(): { confirm: (options: ConfirmOptions) => Promise<boolean>; confirmDialog: ReactNode } {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((isConfirmed: boolean) => void) | null>(null);

  const finish = useCallback((isConfirmed: boolean) => {
    resolveRef.current?.(isConfirmed);
    resolveRef.current = null;
    setOptions(null);
  }, []);

  const confirm = useCallback((next: ConfirmOptions) => {
    // A second request while one is open answers the first with "no".
    resolveRef.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const confirmDialog = (
    <Modal
      isOpen={options !== null}
      title={options?.title ?? ''}
      onClose={() => finish(false)}
      footer={
        options && (
          <>
            {/* Cancel gets focus first, so pressing Enter by habit is always the safe choice. */}
            <button type="button" className="button-quiet" autoFocus onClick={() => finish(false)}>
              {options.cancelLabel ?? 'Cancel'}
            </button>
            <button
              type="button"
              className={options.tone === 'danger' ? 'button-danger-solid' : 'button-primary'}
              onClick={() => finish(true)}
            >
              {options.confirmLabel}
            </button>
          </>
        )
      }
    >
      {options && <div className="confirm-message">{options.message}</div>}
    </Modal>
  );

  return { confirm, confirmDialog };
}
