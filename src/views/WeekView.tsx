import { useState } from 'react';
import { CheckCircleFillIcon, CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, SkipIcon } from '@primer/octicons-react';
import type { Day, Plan, PlanWeek } from '../schema';
import { DAY_NAMES, DAY_ORDER, shortDate } from '../dates';
import { dateOf, getWeek, positionOn, sessionTypesFor, totalWeeks, weekTargetNames, kindOf } from '../plan';
import { useWeekContext } from '../useWeekContext';
import { ProgressCharts } from '../components/charts/ProgressCharts';
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

/** "Long hike 2 h with 6 kg. Recovery 1 h easy walk." — only the targets this plan uses. */
function weekTargetsLine(plan: Plan, w: PlanWeek): string {
  const names = weekTargetNames(plan);
  const parts: string[] = [];
  if (names.hike && w.longHike.hours) parts.push(`${names.hike} ${w.longHike.hours}${w.longHike.packKg ? ` with ${w.longHike.packKg}` : ''}.`);
  if (names.recovery && w.sunday) parts.push(`${names.recovery} ${w.sunday}.`);
  return parts.join(' ');
}

function initialWeek(plan: Plan, today: string): number {
  const pos = positionOn(plan, today);
  if (pos.status === 'active') return pos.week;
  if (pos.status === 'complete') return totalWeeks(plan);
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
        <DayHeader title={`${DAY_NAMES[openDay]}, ${shortDate(dateOf(plan, week, openDay))}`} week={w} total={totalWeeks(plan)} />
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
            disabled={week >= totalWeeks(plan)}
            aria-label="Next week"
          >
            <ChevronRightIcon />
          </button>
        </div>
        <WeekProgress week={week} total={totalWeeks(plan)} />
        {w.notes && <p className="text-muted">{w.notes}</p>}
        <div className="week-targets text-small">
          <span className="text-muted">{weekTargetsLine(plan, w)}</span>
          <button className="btn-invisible" onClick={() => setEditingWeek(true)}>
            Edit week
          </button>
        </div>
      </header>
      {editingWeek && <WeekTargetsDialog plan={plan} week={w} onClose={() => setEditingWeek(false)} />}

      <ul className="box">
        {DAY_ORDER.map((d) => {
          const date = dateOf(plan, week, d);
          const types = sessionTypesFor(plan, week, d, ctx);
          const titles = types.map((t) => plan.templates[t].title);
          const isToday = date === today;
          const status = date <= today ? dayStatus(logs, date, types.filter((t) => kindOf(plan, t) !== 'rest')) : null;
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
      <ProgressCharts plan={plan} week={week} onSelect={setWeek} />
    </section>
  );
}
