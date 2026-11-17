import { useState } from 'react';
import type { Plan, PlanWeek } from '../schema';
import { weekTargetNames } from '../plan';
import { commitOverride } from '../actions';
import { useLogActions } from '../logContext';
import { Dialog } from './Dialog';

/** Edit one week's hike, pack, recovery, endurance and notes (the ones the plan uses). Only changed fields are stored. */
export function WeekTargetsDialog({ plan, week, onClose }: { plan: Plan; week: PlanWeek; onClose: () => void }) {
  const { notify } = useLogActions();
  const names = weekTargetNames(plan);
  const initial = {
    hours: week.longHike.hours,
    packKg: week.longHike.packKg,
    sunday: week.sunday,
    meVolume: week.meVolume,
    notes: week.notes,
  };
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const field = (k: keyof typeof form) => ({
    value: form[k],
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value }),
  });

  const save = () => {
    const f = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])) as typeof form;
    if ((names.hike && (!f.hours || !f.packKg)) || (names.recovery && !f.sunday) || (names.endurance && !f.meVolume))
      return setError('Only the notes can be empty.');
    const changes: { longHike?: PlanWeek['longHike']; sunday?: string; meVolume?: string; notes?: string } = {};
    if (f.hours !== initial.hours || f.packKg !== initial.packKg) changes.longHike = { hours: f.hours, packKg: f.packKg };
    if (f.sunday !== initial.sunday) changes.sunday = f.sunday;
    if (f.meVolume !== initial.meVolume) changes.meVolume = f.meVolume;
    if (f.notes !== initial.notes) changes.notes = f.notes;
    if (Object.keys(changes).length) {
      commitOverride({ kind: 'weekTargets', week: week.week, changes });
      notify(`Week ${week.week} targets saved.`);
    }
    onClose();
  };

  return (
    <Dialog
      title={`Edit week ${week.week}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            Save
          </button>
        </>
      }
    >
      {names.hike && (
        <>
          <p className="box-row box-row--note">The hike's minutes and pack are prefilled from these when you log.</p>
          <label className="box-row field">
            <span className="field-label">Hike length</span>
            <input className="input input--grow" {...field('hours')} />
          </label>
          <label className="box-row field">
            <span className="field-label">Hike pack</span>
            <input className="input input--grow" {...field('packKg')} />
          </label>
        </>
      )}
      {names.recovery && (
        <label className="box-row field field--stacked">
          <span className="field-label">{names.recovery}</span>
          <input className="input input--grow" {...field('sunday')} />
        </label>
      )}
      {names.endurance && (
        <label className="box-row field field--stacked">
          <span className="field-label">{names.endurance}</span>
          <textarea className="input textarea" rows={3} {...field('meVolume')} />
        </label>
      )}
      <label className="box-row field field--stacked">
        <span className="field-label">Notes</span>
        <textarea className="input textarea" rows={2} {...field('notes')} />
      </label>
      {error && <p className="box-row field-error">{error}</p>}
    </Dialog>
  );
}
