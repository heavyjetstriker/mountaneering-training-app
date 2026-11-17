import { useState } from 'react';
import { ChevronRightIcon } from '@primer/octicons-react';
import type { Plan } from '../schema';
import { isValidISO, shortDate, weekdayOf } from '../dates';
import { useAppData } from '../store';
import { useLogActions } from '../logContext';
import { createCycle, switchCycle } from '../actions';
import { BUILT_IN_NAME, blankPlan, copyPlan, defaultCycleStart, mondayOnOrAfter, planProblems } from '../cycles';
import { Dialog } from './Dialog';

type Source = 'blank' | 'builtIn' | string; // or a cycle id

/** New cycle: a name, where to start from, and the start Monday. Opens the editor. */
function NewCycleDialog({ builtIn, plan, today, onClose }: { builtIn: Plan; plan: Plan; today: string; onClose: () => void }) {
  const { cycles } = useAppData();
  const { openCycle } = useLogActions();
  const [name, setName] = useState(`Cycle ${cycles.length + 2}`);
  const [source, setSource] = useState<Source>('builtIn');
  const [start, setStart] = useState(() => defaultCycleStart(plan, today));
  const [error, setError] = useState('');
  const startOk = isValidISO(start) && weekdayOf(start) === 'mon';

  const create = () => {
    const n = name.trim();
    if (!n) return setError('Give the cycle a name.');
    if (n.length > 40) return setError('Keep the name to 40 characters.');
    if (!startOk) return setError('The cycle starts on a Monday.');
    const from = source === 'blank' ? null : source === 'builtIn' ? builtIn : cycles.find((c) => c.id === source)?.plan;
    const p = from ? copyPlan(from, start, n) : blankPlan(start, n);
    const id = createCycle(p);
    if (!id) return setError("Couldn't save: storage on this device is full or blocked.");
    onClose();
    openCycle(id);
  };

  const sources: { value: Source; name: string; text: string }[] = [
    { value: 'builtIn', name: `Copy of the ${BUILT_IN_NAME}`, text: 'Every session, week and rule, ready to change.' },
    ...cycles.map((c) => ({ value: c.id, name: `Copy of ${c.name}`, text: `${c.plan.weeks.length} weeks` })),
    { value: 'blank', name: 'Blank', text: 'Four empty weeks. You add the sessions.' },
  ];

  return (
    <Dialog
      title="New cycle"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={create}>
            Create
          </button>
        </>
      }
    >
      <label className="box-row field">
        <span className="field-label">Name</span>
        <input className="input input--grow" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="box-row field field--stacked" role="radiogroup" aria-label="Start from">
        <span className="field-label">Start from</span>
        {sources.map((s) => (
          <label key={s.value} className="radio-option">
            <input
              type="radio"
              className="checkbox"
              name="cycle-source"
              checked={source === s.value}
              onChange={() => setSource(s.value)}
            />
            <span className="option-day">
              <span className="option-name">{s.name}</span>
              <span className="text-muted text-small">{s.text}</span>
            </span>
          </label>
        ))}
      </div>
      {source !== 'blank' && (
        <p className="box-row box-row--note">A copy is the plan as written, without your plan changes. Your logs and last-time weights still carry over.</p>
      )}
      <label className="box-row field">
        <span className="field-label">Starts</span>
        <input className="input input--grow" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
      </label>
      {!startOk && isValidISO(start) && (
        <div className="box-row field-hint">
          <span>The cycle starts on a Monday.</span>
          <button className="btn" onClick={() => setStart(mondayOnOrAfter(start))}>
            Use {shortDate(mondayOnOrAfter(start))}
          </button>
        </div>
      )}
      {error && <p className="box-row field-error">{error}</p>}
    </Dialog>
  );
}

/** More → Training cycles: the 12-week plan and the cycles I built, which one is in use, and New cycle. */
export function CyclesBox({ builtIn, plan, today }: { builtIn: Plan; plan: Plan; today: string }) {
  const { cycles, activeCycle } = useAppData();
  const { openCycle, notify } = useLogActions();
  const [creating, setCreating] = useState(false);
  const [confirmBack, setConfirmBack] = useState(false);
  const activeExists = cycles.some((c) => c.id === activeCycle);

  return (
    <article className="box" id="cycles">
      <header className="box-header">
        <h2 className="box-title">Training cycles</h2>
        <button className="btn-invisible" onClick={() => setCreating(true)}>
          New cycle
        </button>
      </header>
      <ul>
        <li className="box-row cycle-row">
          <span className="cycle-main">
            <span className="option-name">{BUILT_IN_NAME}</span>
            <span className="text-muted text-small">Built in · {builtIn.weeks.length} weeks</span>
          </span>
          {!activeExists ? (
            <span className="label label--accent">In use</span>
          ) : (
            <button className="btn" onClick={() => setConfirmBack(true)}>
              Use
            </button>
          )}
        </li>
        {cycles.map((c) => {
          const problems = planProblems(c.plan).length;
          return (
            <li key={c.id}>
              <button className="box-row option-row cycle-row" onClick={() => openCycle(c.id)}>
                <span className="cycle-main">
                  <span className="option-name">{c.name}</span>
                  <span className="text-muted text-small">
                    {c.plan.weeks.length} {c.plan.weeks.length === 1 ? 'week' : 'weeks'}
                    {isValidISO(c.plan.startDate) ? ` from ${shortDate(c.plan.startDate)}` : ''}
                  </span>
                </span>
                {c.id === activeCycle && <span className="label label--accent">In use</span>}
                {problems > 0 && (
                  <span className="label label--attention">
                    {problems} {problems === 1 ? 'problem' : 'problems'}
                  </span>
                )}
                <ChevronRightIcon className="text-muted" />
              </button>
            </li>
          );
        })}
      </ul>
      {cycles.length === 0 && (
        <p className="box-row box-row--note">
          Build your next training cycle here: copy the {BUILT_IN_NAME} and change it, or start blank. Then switch to it
          when you're ready.
        </p>
      )}
      {creating && <NewCycleDialog builtIn={builtIn} plan={plan} today={today} onClose={() => setCreating(false)} />}
      {confirmBack && (
        <Dialog
          title={`Use the ${BUILT_IN_NAME}?`}
          onClose={() => setConfirmBack(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmBack(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (switchCycle(null)) notify(`Using the ${BUILT_IN_NAME} again.`);
                  setConfirmBack(false);
                }}
              >
                Use it
              </button>
            </>
          }
        >
          <p className="box-row text-muted">
            Today and Week follow the {BUILT_IN_NAME} again, with your changes to it. Your cycles and logs stay.
          </p>
        </Dialog>
      )}
    </article>
  );
}
