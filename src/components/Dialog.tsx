import { useEffect, useId, useRef, type ReactNode } from 'react';

/** In-app dialog in the Primer box style. Never window.confirm. */
export function Dialog({
  title,
  children,
  onClose,
  footer,
}: {
  title: string;
  children?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, []);

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div
        ref={ref}
        className="box dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="box-header">
          <h2 className="box-title" id={id}>
            {title}
          </h2>
        </header>
        {children}
        {footer && <div className="box-row dialog-footer">{footer}</div>}
      </div>
    </div>
  );
}
