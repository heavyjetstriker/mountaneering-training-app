import type { Day, Plan } from '../schema';
import { getWeek, sessionsFor, DEFAULT_CONTEXT } from '../plan';
import { SessionCard } from './SessionCard';
import { SessionFooter } from './SessionFooter';

/** Everything planned for one day: notice, sessions with their log footers, and reminders. */
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
  const w = getWeek(plan, week);
  const sessions = sessionsFor(plan, week, day, DEFAULT_CONTEXT);
  const isRest = sessions.length === 1 && sessions[0].type === 'rest';
  const gymDay = sessions.some((s) => s.adjustment !== 'none');

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
            week={w}
            footer={<SessionFooter session={s} date={date} today={today} week={week} day={day} />}
          />
        ))
      )}

      <ul className="reminders text-muted text-small">
        {!isRest && <li>{plan.reminders.everySession}</li>}
        <li>{plan.reminders.everyDay}</li>
      </ul>
    </div>
  );
}
