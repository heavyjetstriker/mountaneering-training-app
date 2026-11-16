import type { ReactNode } from 'react';
import { XIcon } from '@primer/octicons-react';

/** Primer Flash: success, danger or neutral, with an optional action and dismiss button. */
export function Flash({
  tone,
  children,
  onDismiss,
  action,
}: {
  tone: 'success' | 'danger' | 'neutral';
  children: ReactNode;
  onDismiss?: () => void;
  action?: ReactNode;
}) {
  return (
    <div className={`flash flash--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <span>{children}</span>
      {action}
      {onDismiss && (
        <button className="btn-invisible btn-icon flash-close" aria-label="Dismiss" onClick={onDismiss}>
          <XIcon />
        </button>
      )}
    </div>
  );
}
