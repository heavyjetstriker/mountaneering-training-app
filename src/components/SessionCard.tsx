import type { ReactNode } from 'react';
import type { PlanWeek } from '../schema';
import { ChevronRightIcon } from '@primer/octicons-react';
import type { ResolvedExercise, ResolvedSession } from '../plan';

const BLOCK_HINT: Record<1 | 2 | 3, string> = {
  1: 'Moderate weight, 2–3 reps in reserve.',
  2: 'Main lifts: add a little weight each week.',
  3: 'Main lifts: hold the weight.',
};

function minutes([lo, hi]: [number, number]): string {
  return lo === hi ? `${lo} min` : `${lo}–${hi} min`;
}

/** One session as a GitHub-style box: header row, then list rows. */
export function SessionCard({
  session,
  week,
  footer,
  onEditExercise,
}: {
  session: ResolvedSession;
  week: PlanWeek;
  footer?: ReactNode;
  /** When set, each exercise row opens the exercise editor. */
  onEditExercise?: (ex: ResolvedExercise) => void;
}) {
  const s = session;
  return (
    <article className="box">
      <header className="box-header">
        <h2 className="box-title">{s.title}</h2>
        {s.cardio && <span className="box-meta">{minutes(s.cardio.minutes)}</span>}
      </header>

      {s.exercises && (
        <>
          <p className="box-row box-row--note">{BLOCK_HINT[week.block]}</p>
          <ul>
            {s.exercises.map((ex) => {
              const body = (
                <>
                  <div>
                    <div className="exercise-name">{ex.name}</div>
                    {(ex.note || ex.targetKg !== undefined) && (
                      <div className="text-muted text-small">
                        {[ex.note, ex.targetKg !== undefined ? `Target ${ex.targetKg} kg` : ''].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="dose" aria-label={`${ex.sets} sets of ${ex.reps}`}>
                    {ex.sets !== ex.originalSets && <del className="text-muted">{ex.originalSets}</del>}
                    <span>
                      {ex.sets} × {ex.reps}
                    </span>
                  </div>
                </>
              );
              return (
                <li key={ex.slotId}>
                  {onEditExercise ? (
                    <button className="box-row exercise exercise--button" onClick={() => onEditExercise(ex)}>
                      {body}
                      <ChevronRightIcon className="text-muted exercise-chevron" />
                    </button>
                  ) : (
                    <div className="box-row exercise">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      {s.cardio && (
        <dl className="facts">
          <div className="box-row">
            <dt>Effort</dt>
            <dd>{s.cardio.zone}</dd>
          </div>
          <div className="box-row">
            <dt>Where</dt>
            <dd>{s.cardio.where}</dd>
          </div>
          {s.intervals && (
            <div className="box-row">
              <dt>Intervals</dt>
              <dd>{s.intervals} × 4 min at Zone 4</dd>
            </div>
          )}
          {s.intervalsLocked && (
            <div className="box-row">
              <dt>Intervals</dt>
              <dd className="text-muted">
                Off. {s.intervalsLocked} × 4 min at Zone 4 once your tests show a threshold gap of 10% or less.
              </dd>
            </div>
          )}
        </dl>
      )}

      {s.target && <p className="box-row target">{s.target}</p>}
      {s.instructions && <p className="box-row text-muted">{s.instructions}</p>}
      {footer}
    </article>
  );
}
