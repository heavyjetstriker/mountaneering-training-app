import type { Day, Plan } from '../schema';
import { getWeek, sessionsFor, DEFAULT_CONTEXT } from '../plan';
import { SessionCard } from './SessionCard';

/** Everything planned for one day: banner, sessions and reminders. */
export function DaySessions({ plan, week, day }: { plan: Plan; week: number; day: Day }) {
  const w = getWeek(plan, week);
  const sessions = sessionsFor(plan, week, day, DEFAULT_CONTEXT);
  const isRest = sessions.length === 1 && sessions[0].type === 'rest';
  const gymDay = sessions.some((s) => s.adjustment !== 'none');

  return (
    <div className="day-sessions">
      {gymDay && w.kind === 'lighter' && (
        <p className="banner">Lighter week: sets and minutes are cut by a third.</p>
      )}
      {gymDay && w.kind === 'test' && (
        <p className="banner">Test week: Monday to Thursday volume is halved.</p>
      )}

      {isRest ? (
        <article className="session session--rest">
          <h2 className="session-title">Rest day</h2>
          <p>No training today.</p>
        </article>
      ) : (
        sessions.map((s, i) => <SessionCard key={`${s.type}-${i}`} session={s} week={w} />)
      )}

      <ul className="reminders">
        {!isRest && <li>{plan.reminders.everySession}</li>}
        <li>{plan.reminders.everyDay}</li>
      </ul>
    </div>
  );
}
