import { useState } from 'react';
import type { Day, Plan, SessionType } from '../schema';
import { DAY_NAMES } from '../dates';
import { blockHint, getWeek, sessionsFor, type ResolvedExercise } from '../plan';
import { useWeekContext } from '../useWeekContext';
import { useAppData } from '../store';
import { SessionCard } from './SessionCard';
import { SessionFooter } from './SessionFooter';
import { TestResultsRows } from './TestResultsRows';
import { TripRows } from './TripRows';
import { ExerciseEditor } from './ExerciseEditor';
import { MoveDayDialog } from './MoveDayDialog';

/** Everything planned for one day: notice, sessions with their log footers, reminders and day actions. */
export function DaySessions({
  plan,
  week,
  day,
  date,
  today,
}: {
  plan: Plan;
  week: number;
  day: Day;
  date: string;
  today: string;
}) {
  const { logs } = useAppData();
  const [editing, setEditing] = useState<{ type: SessionType; ex: ResolvedExercise } | null>(null);
  const [moving, setMoving] = useState(false);
  const w = getWeek(plan, week);
  const ctx = useWeekContext(plan, week);
  const sessions = sessionsFor(plan, week, day, ctx);
  const isRest = sessions.length === 1 && sessions[0].kind === 'rest';
  const gymDay = sessions.some((s) => s.adjustment !== 'none');
  const logged = logs.some((l) => l.date === date && sessions.some((s) => s.type === l.type));
  const editingSession = editing && sessions.find((s) => s.type === editing.type);

  return (
    <div className="stack">
      {gymDay && w.kind === 'lighter' && (
        <p className="flash">Sets and minutes are cut by a third this week.</p>
      )}
      {gymDay && w.kind === 'test' && <p className="flash">Monday to Thursday volume is halved this week.</p>}

      {isRest ? (
        <article className="box">
          <header className="box-header">
            <h2 className="box-title">Rest day</h2>
          </header>
          <p className="box-row text-muted">No training today.</p>
        </article>
      ) : (
        sessions.map((s, i) => (
          <SessionCard
            key={`${s.type}-${i}`}
            session={s}
            hint={blockHint(plan, w.block)}
            onEditExercise={(ex) => setEditing({ type: s.type, ex })}
            footer={
              <>
                <TripRows session={s} date={date} today={today} />
                <TestResultsRows session={s} date={date} today={today} week={week} day={day} />
                <SessionFooter session={s} date={date} today={today} week={week} day={day} />
              </>
            }
          />
        ))
      )}

      <ul className="reminders text-muted text-small">
        {!isRest && <li>{plan.reminders.everySession}</li>}
        <li>{plan.reminders.everyDay}</li>
      </ul>

      {!isRest &&
        (logged ? (
          <p className="text-muted text-small">This day has a log, so it stays on {DAY_NAMES[day]}.</p>
        ) : (
          <div>
            <button className="btn" onClick={() => setMoving(true)}>
              Move {DAY_NAMES[day]} to another day
            </button>
          </div>
        ))}

      {editing && editingSession && (
        <ExerciseEditor
          plan={plan}
          week={week}
          day={day}
          type={editing.type}
          exercise={editing.ex}
          lighterNote={
            editingSession.adjustment === 'none'
              ? undefined
              : `This week's sets are cut. A set count for week ${week} only is used as it is; one from week ${week} on still gets the cut.`
          }
          onClose={() => setEditing(null)}
        />
      )}
      {moving && <MoveDayDialog plan={plan} week={week} day={day} onClose={() => setMoving(false)} />}
    </div>
  );
}
