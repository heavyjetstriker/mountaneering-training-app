import { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@primer/octicons-react';
import type { Day, Plan } from '../schema';
import { DAY_NAMES, DAY_ORDER, shortDate } from '../dates';
import { dateOf, getWeek, positionOn, sessionTypesFor, TOTAL_WEEKS } from '../plan';
import { DayHeader } from '../components/DayHeader';
import { DaySessions } from '../components/DaySessions';
import { WeekProgress } from '../components/WeekProgress';

function initialWeek(plan: Plan, today: string): number {
  const pos = positionOn(plan, today);
  if (pos.status === 'active') return pos.week;
  if (pos.status === 'complete') return TOTAL_WEEKS;
  if (pos.status === 'paused') return pos.nextWeek;
  return 1;
}

export function WeekView({ plan, today }: { plan: Plan; today: string }) {
  const [week, setWeek] = useState(() => initialWeek(plan, today));
  const [openDay, setOpenDay] = useState<Day | null>(null);
  const w = getWeek(plan, week);

  if (openDay) {
    return (
      <section>
        <button className="btn-invisible back" onClick={() => setOpenDay(null)}>
          <ChevronLeftIcon /> Week {week}
        </button>
        <DayHeader title={`${DAY_NAMES[openDay]}, ${shortDate(dateOf(plan, week, openDay))}`} week={w} />
        <DaySessions plan={plan} week={week} day={openDay} />
      </section>
    );
  }

  return (
    <section>
      <header className="page-head">
        <div className="week-nav">
          <button className="btn btn-icon" onClick={() => setWeek(week - 1)} disabled={week === 1} aria-label="Previous week">
            <ChevronLeftIcon />
          </button>
          <div className="week-nav-title">
            <h1 className="page-title">Week {week}</h1>
            <span className="text-muted text-small">
              {shortDate(dateOf(plan, week, 'mon'))} to {shortDate(dateOf(plan, week, 'sun'))}
            </span>
          </div>
          <button
            className="btn btn-icon"
            onClick={() => setWeek(week + 1)}
            disabled={week === TOTAL_WEEKS}
            aria-label="Next week"
          >
            <ChevronRightIcon />
          </button>
        </div>
        <WeekProgress week={week} />
        {w.notes && <p className="text-muted">{w.notes}</p>}
      </header>

      <ul className="box">
        {DAY_ORDER.map((d) => {
          const date = dateOf(plan, week, d);
          const titles = sessionTypesFor(plan, week, d).map((t) => plan.templates[t].title);
          const isToday = date === today;
          return (
            <li key={d}>
              <button
                className={`box-row day-row${d === 'fri' ? ' text-muted' : ''}`}
                onClick={() => {
                  setOpenDay(d);
                  window.scrollTo(0, 0);
                }}
              >
                <span className="day-row-when">
                  <span className="day-row-day">{DAY_NAMES[d].slice(0, 3)}</span>
                  <span className="text-muted text-small">{shortDate(date)}</span>
                </span>
                <span className="day-row-what">{titles.join(', then ')}</span>
                {isToday && <span className="label label--accent">Today</span>}
                <ChevronRightIcon className="text-muted" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
