import { useState } from 'react';
import type { Plan } from '../schema';
import { isValidISO, longDate, shortDate, weekdayOf } from '../dates';
import { dateOf } from '../plan';
import { nearestMonday } from '../backup';
import { changeStartDate } from '../actions';
import { useAppData } from '../store';
import { useLogActions } from '../logContext';
import { Dialog } from './Dialog';

function StartDateDialog({ basePlan, plan, onClose }: { basePlan: Plan; plan: Plan; onClose: () => void }) {
  const { notify } = useLogActions();
  const hasLogs = useAppData().logs.length > 0;
  const [value, setValue] = useState(plan.startDate);
  const valid = isValidISO(value);
  const monday = valid && weekdayOf(value) === 'mon';
  const nearest = valid && !monday ? nearestMonday(value) : null;
  // Same plan and pauses, just a new start: where week 12 would end.
  const endsOn = monday ? dateOf({ ...plan, startDate: value }, 12, 'sun') : null;
  const isPlanDate = value === basePlan.startDate;
  const overridden = plan.startDate !== basePlan.startDate;

  const save = (date: string) => {
    if (date !== plan.startDate) {
      changeStartDate(basePlan, date);
      notify(`The plan now starts on ${longDate(date)}.`);
    }
    onClose();
  };

  return (
    <Dialog
      title="Plan start date"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => save(value)} disabled={!monday}>
            Save
          </button>
        </>
      }
    >
      <label className="box-row field">
        <span className="field-label">Week 1 starts</span>
        <input
          className="input input--grow"
          type="date"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-describedby="start-date-help"
        />
      </label>
      {nearest && (
        <div className="box-row field-hint" id="start-date-help">
          <span>The plan starts on a Monday. {shortDate(nearest)} is the nearest one.</span>
          <button className="btn" onClick={() => setValue(nearest)}>
            Use {shortDate(nearest)}
          </button>
        </div>
      )}
      {!valid && (
        <p className="box-row field-error" id="start-date-help">
          Pick a date.
        </p>
      )}
      {endsOn && (
        <p className="box-row" id="start-date-help">
          Week 1 starts on {longDate(value)}, and week 12 ends on {longDate(endsOn)}.
        </p>
      )}
      {hasLogs && (
        <p className="box-row box-row--note">Logs stay on the dates you trained. Weeks move to match the new start date.</p>
      )}
      {overridden && !isPlanDate && (
        <div className="box-row">
          <button className="btn-invisible" onClick={() => save(basePlan.startDate)}>
            Use the plan's date ({longDate(basePlan.startDate)})
          </button>
        </div>
      )}
    </Dialog>
  );
}

export function SettingsBox({ basePlan, plan }: { basePlan: Plan; plan: Plan }) {
  const [open, setOpen] = useState(false);
  const overridden = plan.startDate !== basePlan.startDate;
  return (
    <article className="box" id="settings">
      <header className="box-header">
        <h2 className="box-title">Settings</h2>
      </header>
      <div className="box-row change-row">
        <div className="change-text">
          <div>Plan starts on {longDate(plan.startDate)}</div>
          {overridden && (
            <div className="text-muted text-small">The plan's own date is {longDate(basePlan.startDate)}.</div>
          )}
        </div>
        <button className="btn-invisible" onClick={() => setOpen(true)}>
          Change
        </button>
      </div>
      {open && <StartDateDialog basePlan={basePlan} plan={plan} onClose={() => setOpen(false)} />}
    </article>
  );
}
