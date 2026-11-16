import { TOTAL_WEEKS } from '../plan';

/** Plain segmented progress bar: one segment per plan week. */
export function WeekProgress({ week }: { week: number }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={TOTAL_WEEKS}
      aria-valuenow={Math.min(week, TOTAL_WEEKS)}
      aria-label={`Week ${Math.min(week, TOTAL_WEEKS)} of ${TOTAL_WEEKS}`}
    >
      {Array.from({ length: TOTAL_WEEKS }, (_, i) => (
        <span key={i} className={i + 1 < week ? 'is-done' : i + 1 === week ? 'is-current' : undefined} />
      ))}
    </div>
  );
}
