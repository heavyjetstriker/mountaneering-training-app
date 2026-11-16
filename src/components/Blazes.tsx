import { TOTAL_WEEKS } from '../plan';

/**
 * The 12 weeks as trail blazes: the yellow-over-red marks painted on rocks
 * along Portuguese PR footpaths. Done weeks are painted, the current one is
 * fresh yellow, the rest are still bare rock.
 */
export function Blazes({ current, onPick }: { current: number | null; onPick?: (week: number) => void }) {
  const weeks = Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1);
  return (
    <ol className="blazes" aria-label={current ? `Week ${current} of ${TOTAL_WEEKS}` : 'Plan weeks'}>
      {weeks.map((w) => {
        const state = current === null ? 'ahead' : w < current ? 'done' : w === current ? 'now' : 'ahead';
        const label = `Week ${w}`;
        return (
          <li key={w} className={`blaze blaze--${state}`}>
            {onPick ? (
              <button onClick={() => onPick(w)} aria-label={label} aria-current={w === current ? 'step' : undefined} />
            ) : (
              <span aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
