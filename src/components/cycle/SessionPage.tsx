import { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@primer/octicons-react';
import { SESSION_KINDS, TEST_KINDS, type Exercise, type Plan, type SessionKind, type SessionType } from '../../schema';
import {
  addExercise,
  deleteExercise,
  deleteSession,
  KIND_HELP,
  KIND_TEXT,
  moveExercise,
  updateExercise,
  updateSession,
} from '../../cycles';
import { TEST_TITLES } from '../../tests';
import { Dialog } from '../Dialog';
import { ExerciseDialog } from './ExerciseDialog';
import { Check, TextField } from './fields';

/** Whole minutes 1–600 from a text field, or null. */
function minutesOf(text: string): number | null {
  const n = Number(text.trim());
  return Number.isInteger(n) && n >= 1 && n <= 600 ? n : null;
}

function CardioBox({ plan, id, edit }: { plan: Plan; id: SessionType; edit: (p: (plan: Plan) => Plan) => void }) {
  const t = plan.templates[id];
  const cardio = t.cardio ?? { minutes: [30, 45] as [number, number], zone: 'Zone 2', where: '' };
  const [lo, setLo] = useState(String(cardio.minutes[0]));
  const [hi, setHi] = useState(String(cardio.minutes[1]));
  const [error, setError] = useState('');
  const set = (patch: Partial<typeof cardio>) => edit((p) => updateSession(p, id, { cardio: { ...cardio, ...patch } }));
  const commitMinutes = () => {
    const a = minutesOf(lo);
    const b = minutesOf(hi);
    if (a === null || b === null) return setError('Minutes are whole numbers from 1 to 600.');
    if (a > b) return setError('The first number is the shortest, the second the longest.');
    setError('');
    if (a !== cardio.minutes[0] || b !== cardio.minutes[1]) set({ minutes: [a, b] });
  };

  return (
    <article className="box">
      <header className="box-header">
        <h2 className="box-title">Cardio</h2>
      </header>
      <div className="box-row field">
        <span className="field-label">Minutes</span>
        <input
          className="input input--num"
          inputMode="numeric"
          aria-label="Shortest minutes"
          value={lo}
          onChange={(e) => setLo(e.target.value)}
          onBlur={commitMinutes}
        />
        <span className="text-muted">to</span>
        <input
          className="input input--num"
          inputMode="numeric"
          aria-label="Longest minutes"
          value={hi}
          onChange={(e) => setHi(e.target.value)}
          onBlur={commitMinutes}
        />
      </div>
      {error && <p className="box-row field-error">{error}</p>}
      <TextField label="Effort" value={cardio.zone} placeholder="Zone 2" onCommit={(zone) => set({ zone })} />
      <TextField label="Where" value={cardio.where} placeholder="Incline treadmill" onCommit={(where) => set({ where })} />
      <Check
        label="Carries the week's intervals"
        hint="When the tests unlock intervals, each week's intervals go in this session."
        checked={!!t.intervals}
        onChange={(v) => edit((p) => updateSession(p, id, { intervals: v }))}
      />
      {t.intervals && (
        <TextField
          label="How to run them"
          multiline
          value={t.intervalsHow ?? ''}
          onCommit={(intervalsHow) => edit((p) => updateSession(p, id, { intervalsHow }))}
        />
      )}
    </article>
  );
}

function TestBox({ plan, id, edit }: { plan: Plan; id: SessionType; edit: (p: (plan: Plan) => Plan) => void }) {
  const t = plan.templates[id];
  const tests = t.tests ?? [];
  const others = Object.values(plan.templates).filter((o) => o.type !== id && o.kind !== 'rest' && !o.onlyIfIntervalsOff);
  return (
    <article className="box">
      <header className="box-header">
        <h2 className="box-title">Results to enter</h2>
      </header>
      {TEST_KINDS.map((k) => (
        <Check
          key={k}
          label={TEST_TITLES[k]}
          checked={tests.includes(k)}
          onChange={(v) =>
            edit((p) => updateSession(p, id, { tests: TEST_KINDS.filter((x) => (x === k ? v : tests.includes(x))) }))
          }
        />
      ))}
      <label className="box-row field field--stacked">
        <span className="field-label">When</span>
        <select
          className="input"
          value={t.onlyIfIntervalsOff ?? ''}
          onChange={(e) => edit((p) => updateSession(p, id, { onlyIfIntervalsOff: e.target.value || undefined }))}
        >
          <option value="">Always</option>
          {others.map((o) => (
            <option key={o.type} value={o.type}>
              Only while intervals are off, otherwise {o.title}
            </option>
          ))}
        </select>
      </label>
    </article>
  );
}

function ExercisesBox({ plan, id, edit }: { plan: Plan; id: SessionType; edit: (p: (plan: Plan) => Plan) => void }) {
  const list = plan.templates[id].exercises ?? [];
  const [open, setOpen] = useState<Exercise | 'new' | null>(null);
  const current = open && open !== 'new' ? list.find((e) => e.id === open.id) ?? null : null;
  const index = current ? list.indexOf(current) : -1;

  return (
    <article className="box">
      <header className="box-header">
        <h2 className="box-title">Exercises</h2>
        <button className="btn-invisible" onClick={() => setOpen('new')}>
          Add exercise
        </button>
      </header>
      {list.length === 0 ? (
        <p className="box-row text-muted">No exercises yet.</p>
      ) : (
        <ul>
          {list.map((ex) => (
            <li key={ex.id}>
              <button className="box-row exercise exercise--button" onClick={() => setOpen(ex)}>
                <div>
                  <div className="exercise-name">{ex.name}</div>
                  {(ex.mainLift || ex.note || ex.swaps?.length) && (
                    <div className="text-muted text-small">
                      {[ex.mainLift ? 'Main lift' : '', ex.note ?? '', ex.swaps?.length ? `${ex.swaps.length} ${ex.swaps.length === 1 ? 'swap' : 'swaps'}` : '']
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  )}
                </div>
                <div className="dose">
                  {ex.sets} × {ex.reps}
                </div>
                <ChevronRightIcon className="text-muted exercise-chevron" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && (open === 'new' || current) && (
        <ExerciseDialog
          key={open === 'new' ? 'new' : current!.id}
          exercise={open === 'new' ? null : current}
          library={plan.exerciseLibrary}
          onSave={(fields) => {
            edit((p) => (open === 'new' ? addExercise(p, id, fields) : updateExercise(p, id, current!.id, fields)));
            setOpen(null);
          }}
          onDelete={
            current
              ? () => {
                  edit((p) => deleteExercise(p, id, current.id));
                  setOpen(null);
                }
              : undefined
          }
          onMove={current ? (by) => edit((p) => moveExercise(p, id, current.id, by)) : undefined}
          canMove={{ up: index > 0, down: index >= 0 && index < list.length - 1 }}
          onClose={() => setOpen(null)}
        />
      )}
    </article>
  );
}

/** One session of a cycle: title, kind, and what that kind needs. */
export function SessionPage({
  plan,
  id,
  cycleName,
  edit,
  onBack,
}: {
  plan: Plan;
  id: SessionType;
  cycleName: string;
  edit: (change: (plan: Plan) => Plan) => void;
  onBack: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const t = plan.templates[id];
  if (!t) return null;
  const used = [...Object.values(plan.weekly).flat(), ...plan.weeks.flatMap((w) => Object.values(w.dayChanges ?? {}).flat())].includes(id);

  return (
    <section>
      <header className="log-head">
        <button className="btn-invisible back" onClick={onBack}>
          <ChevronLeftIcon /> {cycleName}
        </button>
        <h1 className="page-title">{t.title}</h1>
      </header>
      <div className="stack">
        <article className="box">
          <header className="box-header">
            <h2 className="box-title">Session</h2>
          </header>
          <TextField label="Title" value={t.title} required maxLength={60} onCommit={(title) => edit((p) => updateSession(p, id, { title }))} />
          {id === 'rest' ? (
            <p className="box-row box-row--note">The cycle's rest day. Days with nothing else on them use it.</p>
          ) : (
            <>
              <label className="box-row field">
                <span className="field-label">Kind</span>
                <select
                  className="input input--grow"
                  value={t.kind}
                  onChange={(e) => edit((p) => updateSession(p, id, { kind: e.target.value as SessionKind }))}
                >
                  {SESSION_KINDS.filter((k) => k !== 'rest').map((k) => (
                    <option key={k} value={k}>
                      {KIND_TEXT[k]}
                    </option>
                  ))}
                </select>
              </label>
              <p className="box-row box-row--note">{KIND_HELP[t.kind]}</p>
            </>
          )}
        </article>

        {t.kind === 'strength' && <ExercisesBox plan={plan} id={id} edit={edit} />}
        {t.kind === 'cardio' && <CardioBox key={id} plan={plan} id={id} edit={edit} />}
        {t.kind === 'test' && <TestBox plan={plan} id={id} edit={edit} />}

        <article className="box">
          <header className="box-header">
            <h2 className="box-title">Instructions</h2>
          </header>
          <TextField
            label="Shown on the session"
            multiline
            value={t.instructions ?? ''}
            placeholder="Optional. A new line starts a new paragraph."
            onCommit={(instructions) => edit((p) => updateSession(p, id, { instructions }))}
          />
        </article>

        {!used && id !== 'rest' && (
          <p className="text-muted text-small">This session isn't on any day yet. Add it in Week pattern or a week's days.</p>
        )}
        {id !== 'rest' && (
          <div>
            <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
              Delete session
            </button>
          </div>
        )}
      </div>
      {confirmDelete && (
        <Dialog
          title={`Delete ${t.title}?`}
          onClose={() => setConfirmDelete(false)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  setConfirmDelete(false);
                  onBack();
                  edit((p) => deleteSession(p, id));
                }}
              >
                Delete
              </button>
            </>
          }
        >
          <p className="box-row text-muted">It is taken off every day it's on in this cycle. Logs keep what you did.</p>
        </Dialog>
      )}
    </section>
  );
}
