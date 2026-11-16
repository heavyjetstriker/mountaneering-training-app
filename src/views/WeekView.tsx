import { useState } from 'react';
import type { Day, Plan } from '../schema';
import { DAY_NAMES, DAY_ORDER, shortDate } from '../dates';
import { blockLabel, dateOf, getWeek, positionOn, sessionTypesFor, TOTAL_WEEKS } from '../plan';
import { Blazes } from '../components/Blazes';
import { DaySessions } from '../components/DaySessions';

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
        <button className="back" onClick={() => setOpenDay(null)}>
          Back to week {week}
        </button>
        <header className="today-head">
          <p className="week-line">
            <span>
              Week {week} of {TOTAL_WEEKS}
            </span>
            <span>{blockLabel(w)}</span>
          </p>
          <h1 className="day-name">{DAY_NAMES[openDay]}</h1>
          <p className="date-line">{shortDate(dateOf(plan, week, openDay))}</p>
        </header>
        <DaySessions plan={plan} week={week} day={openDay} />
      </section>
    );
  }

  return (
    <section>
      <header className="week-head">
        <button className="step" onClick={() => setWeek(week - 1)} disabled={week === 1} aria-label="Previous week">
          ‹
        </button>
        <div className="week-head-title">
          <h1 className="screen-title">Week {week}</h1>
          <p className="muted">
            {shortDate(dateOf(plan, week, 'mon'))} to {shortDate(dateOf(plan, week, 'sun'))}
          </p>
          <p className="muted">{blockLabel(w)}</p>
        </div>
        <button
          className="step"
          onClick={() => setWeek(week + 1)}
          disabled={week === TOTAL_WEEKS}
          aria-label="Next week"
        >
          ›
        </button>
      </header>
      <Blazes current={week} onPick={setWeek} />
      {w.notes && <p className="week-note">{w.notes}</p>}

      <ol className="days">
        {DAY_ORDER.map((d) => {
          const date = dateOf(plan, week, d);
          const titles = sessionTypesFor(plan, week, d).map((t) => plan.templates[t].title);
          const rest = d === 'fri';
          return (
            <li key={d}>
              <button
                className={`day-row${date === today ? ' day-row--today' : ''}${rest ? ' day-row--rest' : ''}`}
                onClick={() => {
                  setOpenDay(d);
                  window.scrollTo(0, 0);
                }}
              >
                <span className="day-row-when">
                  <b>{DAY_NAMES[d].slice(0, 3)}</b>
                  <span>{shortDate(date)}</span>
                </span>
                <span className="day-row-what">{titles.join(', then ')}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
