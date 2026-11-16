import { useState } from 'react';
import { CheckCircleFillIcon, CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, SkipIcon } from '@primer/octicons-react';
import type { Day, Plan } from '../schema';
import { DAY_NAMES, DAY_ORDER, shortDate } from '../dates';
import { dateOf, getWeek, positionOn, sessionTypesFor, TOTAL_WEEKS } from '../plan';
import { useWeekContext } from '../useWeekContext';
import { DayHeader } from '../components/DayHeader';
import { DaySessions } from '../components/DaySessions';
import { WeekProgress } from '../components/WeekProgress';
import { WeekTargetsDialog } from '../components/WeekTargetsDialog';
import { useAppData } from '../store';
import { dayStatus, type DayStatus } from '../logs';

function StatusIcon({ status }: { status: DayStatus | null }) {
  if (status === 'done') return <CheckCircleFillIcon className="status-icon status-icon--done" aria-label="Done" />;
  if (status === 'partial') return <CheckCircleIcon className="status-icon status-icon--partial" aria-label="Partly done" />;
  if (status === 'skipped') return <SkipIcon className="status-icon status-icon--skipped" aria-label="Skipped" />;
  return null;
}

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
  const { logs } = useAppData();
  const [editingWeek, setEditingWeek] = useState(false);
  const w = getWeek(plan, week);
  const ctx = useWeekContext(plan, week);

  if (openDay) {
    return (
      <section>
        <button className="btn-invisible back" onClick={() => setOpenDay(null)}>
          <ChevronLeftIcon /> Week {week}
        </button>
        <DayHeader title={`${DAY_NAMES[openDay]}, ${shortDate(dateOf(plan, week, openDay))}`} week={w} />
        <DaySessions plan={plan} week={week} day={openDay} date={dateOf(plan, week, openDay)} today={today} />
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
        <div className="week-targets text-small">
          <span className="text-muted">
            Saturday {w.longHike.hours} with {w.longHike.packKg}. Sunday {w.sunday}.
          </span>
          <button className="btn-invisible" onClick={() => setEditingWeek(true)}>
            Edit week
          </button>
        </div>
      </header>
      {editingWeek && <WeekTargetsDialog week={w} onClose={() => setEditingWeek(false)} />}

      <ul className="box">
        {DAY_ORDER.map((d) => {
          const date = dateOf(plan, week, d);
          const types = sessionTypesFor(plan, week, d, ctx);
          const titles = types.map((t) => plan.templates[t].title);
          const isToday = date === today;
          const status = date <= today ? dayStatus(logs, date, types) : null;
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
                <StatusIcon status={status} />
                <ChevronRightIcon className="text-muted" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
