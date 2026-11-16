import type { Plan } from '../schema';
import { DAY_NAMES, longDate, shortDate } from '../dates';
import { blockLabel, getWeek, positionOn, TOTAL_WEEKS } from '../plan';
import { Blazes } from '../components/Blazes';
import { DaySessions } from '../components/DaySessions';

export function TodayView({ plan, today }: { plan: Plan; today: string }) {
  const pos = positionOn(plan, today);

  if (pos.status === 'before') {
    return (
      <section className="state">
        <h1 className="day-name">Not yet</h1>
        <p>The plan starts on {longDate(pos.startDate)}.</p>
      </section>
    );
  }
  if (pos.status === 'complete') {
    return (
      <section className="state">
        <Blazes current={TOTAL_WEEKS + 1} />
        <h1 className="day-name">Plan complete</h1>
        <p>
          All 12 weeks done on {shortDate(pos.endedOn)}. Repeat Block 3 with heavier packs, or set a new start
          date in settings.
        </p>
      </section>
    );
  }
  if (pos.status === 'paused') {
    return (
      <section className="state">
        <h1 className="day-name">Paused</h1>
        <p>
          The plan resumes on {longDate(pos.resumesOn)} with week {pos.nextWeek}.
        </p>
        <p>{plan.reminders.everyDay}</p>
      </section>
    );
  }

  const w = getWeek(plan, pos.week);
  return (
    <section>
      <header className="today-head">
        <p className="week-line">
          <span>
            Week {pos.week} of {TOTAL_WEEKS}
          </span>
          <span>{blockLabel(w)}</span>
        </p>
        <h1 className="day-name">{DAY_NAMES[pos.day]}</h1>
        <p className="date-line">{shortDate(today)}</p>
        <Blazes current={pos.week} />
        {w.notes && <p className="week-note">{w.notes}</p>}
      </header>
      <DaySessions plan={plan} week={pos.week} day={pos.day} />
    </section>
  );
}
