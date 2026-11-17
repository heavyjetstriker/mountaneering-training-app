/** Plain segmented progress bar: one segment per plan week. */
export function WeekProgress({ week, total }: { week: number; total: number }) {
  return (
    <div
      className="progress"
      style={{ gridTemplateColumns: `repeat(${total}, 1fr)` }}
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={Math.min(week, total)}
      aria-label={`Week ${Math.min(week, total)} of ${total}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i + 1 < week ? 'is-done' : i + 1 === week ? 'is-current' : undefined} />
      ))}
    </div>
  );
}
