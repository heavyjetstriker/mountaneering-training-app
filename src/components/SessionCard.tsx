import type { PlanWeek } from '../schema';
import type { ResolvedSession } from '../plan';

const BLOCK_HINT: Record<1 | 2 | 3, string> = {
  1: 'Moderate weight, 2–3 reps in reserve.',
  2: 'Main lifts: add a little weight each week.',
  3: 'Main lifts: hold the weight.',
};

function minutes([lo, hi]: [number, number]): string {
  return lo === hi ? `${lo} min` : `${lo}–${hi} min`;
}

export function SessionCard({ session, week }: { session: ResolvedSession; week: PlanWeek }) {
  const s = session;
  return (
    <article className={`session session--${s.type}`}>
      <h2 className="session-title">{s.title}</h2>

      {s.exercises && (
        <>
          <p className="session-hint">{BLOCK_HINT[week.block]}</p>
          <ul className="exercises">
            {s.exercises.map((ex) => (
              <li key={ex.id} className="exercise">
                <div className="exercise-name">
                  {ex.name}
                  {ex.note && <span className="exercise-note">{ex.note}</span>}
                </div>
                <div className="exercise-dose" aria-label={`${ex.sets} sets of ${ex.reps}`}>
                  {ex.sets !== ex.originalSets && <s className="was">{ex.originalSets}</s>}
                  <b>{ex.sets}</b>
                  <span className="times">×</span>
                  <b>{ex.reps}</b>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {s.cardio && (
        <div className="cardio">
          <div className="big-figure">{minutes(s.cardio.minutes)}</div>
          <p>
            {s.title.toLowerCase().includes(s.cardio.where.toLowerCase())
              ? `${s.cardio.zone}.`
              : `${s.cardio.zone}: ${s.cardio.where.toLowerCase()}.`}
          </p>
          {s.intervals && (
            <p className="intervals">
              Include intervals: {s.intervals} × 4 min at Zone 4.
            </p>
          )}
          {s.intervalsLocked && (
            <p className="muted">
              Intervals ({s.intervalsLocked} × 4 min at Zone 4) are off until your tests show a threshold gap of 10% or less.
            </p>
          )}
        </div>
      )}

      {s.target && <p className="target">{s.target}</p>}
      {s.instructions && <p className="instructions">{s.instructions}</p>}
    </article>
  );
}
