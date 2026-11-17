import type { Plan } from '../schema';
import { DAY_NAMES, longDate, shortDate } from '../dates';
import { getWeek, positionOn, totalWeeks } from '../plan';
import { DayHeader } from '../components/DayHeader';
import { DaySessions } from '../components/DaySessions';
import { exportAgeText, shouldRemindBackup } from '../backup';
import { useAppData } from '../store';
import { useMeta } from '../meta';
import { useLogActions } from '../logContext';

/** A quiet line at the bottom of Today, never a Flash: logs saved and no export for a week. */
function BackupReminder({ today }: { today: string }) {
  const data = useAppData();
  const meta = useMeta();
  const { openMore } = useLogActions();
  if (!shouldRemindBackup(data, meta, today)) return null;
  const age = exportAgeText(meta, today);
  return (
    <p className="backup-reminder text-muted text-small">
      <span>{age === 'never' ? 'No backup exported yet.' : `Last export ${age}.`}</span>
      <button className="link-button" onClick={() => openMore('backup')}>
        Export a backup
      </button>
    </p>
  );
}

function TodayBody({ plan, today }: { plan: Plan; today: string }) {
  const pos = positionOn(plan, today);
  const { openMore } = useLogActions();

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
          All {totalWeeks(plan)} weeks finished on {shortDate(pos.endedOn)}. Build your next cycle, repeat the last
          block with heavier packs, or start this plan again.
        </p>
        <p className="blankslate-actions">
          <button className="link-button" onClick={() => openMore('cycles')}>
            Build a new cycle
          </button>
          <button className="link-button" onClick={() => openMore('settings')}>
            Set a new start date
          </button>
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
      <DayHeader title={`${DAY_NAMES[pos.day]}, ${shortDate(today)}`} week={getWeek(plan, pos.week)} total={totalWeeks(plan)} />
      <DaySessions plan={plan} week={pos.week} day={pos.day} date={today} today={today} />
    </section>
  );
}

export function TodayView({ plan, today }: { plan: Plan; today: string }) {
  return (
    <>
      <TodayBody plan={plan} today={today} />
      <BackupReminder today={today} />
    </>
  );
}
