import type { ReactNode } from 'react';
import { ChevronRightIcon } from '@primer/octicons-react';
import type { ResolvedExercise, ResolvedSession } from '../plan';
import { GAP_LIMIT, pctText } from '../tests';
import { useLogActions } from '../logContext';

function minutes([lo, hi]: [number, number]): string {
  return lo === hi ? `${lo} min` : `${lo}–${hi} min`;
}

/** Why Tuesday intervals are off, in plain words, with a way to fix it. */
function IntervalsOff({ off }: { off: NonNullable<ResolvedSession['intervalsOff']> }) {
  const { openTests } = useLogActions();
  if (off.reason === 'gapTooBig') {
    return (
      <span className="text-muted">
        Off: threshold gap {pctText(off.gap)}. Intervals start at {GAP_LIMIT}% or less. Keep Tuesday fully Zone 2.
      </span>
    );
  }
  return (
    <>
      <span className="text-muted">
        {off.reason === 'noThreshold'
          ? 'Off until you add a threshold test.'
          : 'Off until a drift test sets your aerobic threshold.'}
      </span>
      <button className="link-button" onClick={openTests}>
        Add a test result
      </button>
    </>
  );
}

/** One session as a GitHub-style box: header row, then list rows. */
export function SessionCard({
  session,
  hint,
  footer,
  onEditExercise,
}: {
  session: ResolvedSession;
  /** The block's line under strength sessions (plan rules). */
  hint?: string;
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
          {hint && <p className="box-row box-row--note">{hint}</p>}
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
              <dd className="intervals-off">
                <span>{s.intervals} × 4 min at Zone 4</span>
                {s.intervalsHow && <span className="text-muted text-small">{s.intervalsHow}</span>}
              </dd>
            </div>
          )}
          {s.intervalsLocked && s.intervalsOff && (
            <div className="box-row">
              <dt>Intervals</dt>
              <dd className="intervals-off">
                <IntervalsOff off={s.intervalsOff} />
              </dd>
            </div>
          )}
        </dl>
      )}

      {s.target && <p className="box-row target">{s.target}</p>}
      {s.instructions &&
        s.instructions.split('\n').map((para) => (
          <p className="box-row text-muted" key={para}>
            {para}
          </p>
        ))}
      {footer}
    </article>
  );
}
