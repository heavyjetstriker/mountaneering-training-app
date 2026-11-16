/** Primer-style segmented control. With `allowNone`, tapping the selected option clears it. */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  allowNone = false,
}: {
  label: string;
  options: { value: T; label: string; ariaLabel?: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
  allowNone?: boolean;
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={o.ariaLabel}
            className="segmented-item"
            onClick={() => onChange(selected && allowNone ? null : o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
