import type { Plan } from '../schema';
import { DAY_NAMES, longDate, shortDate } from '../dates';
import { getWeek, positionOn } from '../plan';
import { DayHeader } from '../components/DayHeader';
import { DaySessions } from '../components/DaySessions';

export function TodayView({ plan, today }: { plan: Plan; today: string }) {
  const pos = positionOn(plan, today);

  if (pos.status === 'before') {
    return (
      <section className="blankslate">
        <h1 className="page-title">The plan hasn't started</h1>
        <p className="text-muted">It starts on {longDate(pos.startDate)}.</p>
      </section>
    );
  }
  if (pos.status === 'complete') {
    return (
      <section className="blankslate">
        <h1 className="page-title">Plan complete</h1>
        <p className="text-muted">
          All 12 weeks finished on {shortDate(pos.endedOn)}. Repeat Block 3 with heavier packs, or set a new start
          date in settings.
        </p>
      </section>
    );
  }
  if (pos.status === 'paused') {
    return (
      <section className="blankslate">
        <h1 className="page-title">Plan paused</h1>
        <p className="text-muted">
          It resumes on {longDate(pos.resumesOn)} with week {pos.nextWeek}.
        </p>
        <p className="text-muted">{plan.reminders.everyDay}</p>
      </section>
    );
  }

  return (
    <section>
      <DayHeader title={`${DAY_NAMES[pos.day]}, ${shortDate(today)}`} week={getWeek(plan, pos.week)} />
      <DaySessions plan={plan} week={pos.week} day={pos.day} date={today} today={today} />
    </section>
  );
}
