import { useState } from 'react';
import type { Plan } from '../schema';
import type { OverrideRecord } from '../logSchema';
import { addDays, longDate } from '../dates';
import { positionOn, totalWeeks, weekStartDate } from '../plan';
import { describeOverride, listOverrides } from '../overrides';
import { commitOverride, resetAll, resetOverride } from '../actions';
import { useAppData } from '../store';
import { useLogActions } from '../logContext';
import { Dialog } from '../components/Dialog';
import { Segmented } from '../components/Segmented';
import { BackupBox } from '../components/BackupBox';
import { SettingsBox } from '../components/SettingsBox';
import { GearBox } from '../components/GearBox';
import { CyclesBox } from '../components/CyclesBox';

function PausePlan({ plan, today }: { plan: Plan; today: string }) {
  const { notify } = useLogActions();
  const pos = positionOn(plan, today);
  const current = pos.status === 'active' ? pos.week : pos.status === 'paused' ? pos.nextWeek : pos.status === 'before' ? 1 : null;
  const [from, setFrom] = useState<number | null>(current);
  const [weeks, setWeeks] = useState<number>(1);

  if (current === null || from === null) {
    return (
      <article className="box">
        <header className="box-header">
          <h2 className="box-title">Pause plan</h2>
        </header>
        <p className="box-row text-muted">The plan is complete, so there's nothing to pause.</p>
      </article>
    );
  }

  const fromOptions = [current, current + 1].filter((w) => w <= totalWeeks(plan));
  const label = (w: number) =>
    pos.status === 'active' && w === current ? `This week (${w})` : pos.status === 'active' ? `Next week (${w})` : `Week ${w}`;
  const newStart = addDays(weekStartDate(plan, from), weeks * 7);
  const newEnd = addDays(weekStartDate(plan, totalWeeks(plan)), weeks * 7 + 6);
  const pausingThisWeek = pos.status === 'active' && from === current;

  const pause = () => {
    commitOverride({ kind: 'pause', fromWeek: from, weeks });
    notify(`Plan paused ${weeks} ${weeks === 1 ? 'week' : 'weeks'}.`);
  };

  return (
    <article className="box">
      <header className="box-header">
        <h2 className="box-title">Pause plan</h2>
      </header>
      <p className="box-row box-row--note">
        After illness or travel, push the rest of the plan back by whole weeks. Friday stays your rest day.
      </p>
      <div className="box-row field field--stacked">
        <span className="field-label">Starting</span>
        <Segmented
          label="Starting"
          options={fromOptions.map((w) => ({ value: w, label: label(w) }))}
          value={from}
          onChange={(v) => v && setFrom(v)}
        />
      </div>
      <div className="box-row field field--stacked">
        <span className="field-label">For</span>
        <Segmented
          label="Pause for"
          options={[1, 2, 3, 4].map((n) => ({ value: n, label: `${n} wk`, ariaLabel: `${n} ${n === 1 ? 'week' : 'weeks'}` }))}
          value={weeks}
          onChange={(v) => v && setWeeks(v)}
        />
      </div>
      <p className="box-row">
        Week {from} will start on {longDate(newStart)}, and the plan will end on {longDate(newEnd)}.
        {pausingThisWeek && ' Sessions already logged this week stay on their dates.'}
      </p>
      <div className="box-row">
        <button className="btn" onClick={pause}>
          Pause {weeks} {weeks === 1 ? 'week' : 'weeks'}
        </button>
      </div>
    </article>
  );
}

function PlanChanges({ basePlan }: { basePlan: Plan }) {
  const data = useAppData();
  const { notify } = useLogActions();
  const changes = listOverrides(data);
  const [confirm, setConfirm] = useState<OverrideRecord | 'all' | null>(null);

  const doReset = () => {
    if (confirm === 'all') {
      resetAll();
      notify('All changes reset. You are back on the original plan.');
    } else if (confirm) {
      resetOverride(confirm.id);
      notify('Change reset.');
    }
    setConfirm(null);
  };

  return (
    <article className="box">
      <header className="box-header">
        <h2 className="box-title">Your plan changes</h2>
        {changes.length > 1 && (
          <button className="btn-invisible btn-invisible--danger" onClick={() => setConfirm('all')}>
            Reset all
          </button>
        )}
      </header>
      {changes.length === 0 ? (
        <p className="box-row text-muted">
          No changes yet. Tap an exercise to edit or replace it, move a day from its page, or edit a week in the Week tab.
          Every change shows up here and can be reset.
        </p>
      ) : (
        <ul>
          {changes.map((c) => (
            <li key={c.id} className="box-row change-row">
              <span className="change-text">{describeOverride(basePlan, c, changes)}</span>
              <button className="btn-invisible" onClick={() => setConfirm(c)}>
                Reset
              </button>
            </li>
          ))}
        </ul>
      )}
      {confirm && (
        <Dialog
          title={confirm === 'all' ? 'Reset all changes?' : 'Reset this change?'}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirm(null)}>
                Keep
              </button>
              <button className="btn btn-danger" onClick={doReset}>
                Reset
              </button>
            </>
          }
        >
          <p className="box-row text-muted">
            {confirm === 'all'
              ? `All ${changes.length} changes go, and the plan is back to the original. Your logs stay.`
              : `${describeOverride(basePlan, confirm, changes)}. The plan goes back to the original here. Your logs stay.`}
          </p>
        </Dialog>
      )}
    </article>
  );
}

export function MoreView({ builtIn, basePlan, plan, today }: { builtIn: Plan; basePlan: Plan; plan: Plan; today: string }) {
  return (
    <section>
      <header className="page-head">
        <h1 className="page-title">More</h1>
      </header>
      <div className="stack">
        <GearBox plan={plan} />
        <CyclesBox builtIn={builtIn} plan={plan} today={today} />
        <PlanChanges basePlan={basePlan} />
        <PausePlan plan={plan} today={today} />
        <SettingsBox basePlan={basePlan} plan={plan} />
        <BackupBox today={today} />
      </div>
    </section>
  );
}
