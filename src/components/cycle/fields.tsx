import { useEffect, useState } from 'react';
import { DashIcon, PlusIcon } from '@primer/octicons-react';

/**
 * A text field that saves when I leave it (or press Enter on a one-line field), so the store
 * isn't written on every key. `required` keeps the old value when left empty.
 */
export function TextField({
  label,
  value,
  onCommit,
  multiline = false,
  stacked = false,
  required = false,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  multiline?: boolean;
  stacked?: boolean;
  required?: boolean;
  placeholder?: string;
  maxLength?: number;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const v = draft.trim();
    if (required && !v) return setDraft(value);
    if (v !== value) onCommit(v);
  };
  return (
    <label className={`box-row field${stacked || multiline ? ' field--stacked' : ''}`}>
      <span className="field-label">{label}</span>
      {multiline ? (
        <textarea
          className="input textarea"
          rows={3}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
        />
      ) : (
        <input
          className="input input--grow"
          value={draft}
          placeholder={placeholder}
          maxLength={maxLength}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      )}
    </label>
  );
}

/** − n + for whole numbers in a range. */
export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  unit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  unit?: (n: number) => string;
}) {
  return (
    <div className="box-row field">
      <span className="field-label">{label}</span>
      <div className="stepper stepper--inline">
        <button className="btn btn-icon" aria-label={`Fewer: ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
          <DashIcon />
        </button>
        <span className="stepper-value" aria-live="polite">
          {unit ? unit(value) : value}
        </span>
        <button className="btn btn-icon" aria-label={`More: ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
          <PlusIcon />
        </button>
      </div>
    </div>
  );
}

export function Check({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="box-row checkbox-field">
      <input type="checkbox" className="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="option-day">
        <span>{label}</span>
        {hint && <span className="text-muted text-small">{hint}</span>}
      </span>
    </label>
  );
}
