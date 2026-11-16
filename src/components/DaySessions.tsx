import type { Day, Plan } from '../schema';
import { getWeek, sessionsFor, DEFAULT_CONTEXT } from '../plan';
import { SessionCard } from './SessionCard';

/** Everything planned for one day: notice, sessions and reminders. */
export function DaySessions({ plan, week, day }: { plan: Plan; week: number; day: Day }) {
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
        sessions.map((s, i) => <SessionCard key={`${s.type}-${i}`} session={s} week={w} />)
      )}

      <ul className="reminders text-muted text-small">
        {!isRest && <li>{plan.reminders.everySession}</li>}
        <li>{plan.reminders.everyDay}</li>
      </ul>
    </div>
  );
}
