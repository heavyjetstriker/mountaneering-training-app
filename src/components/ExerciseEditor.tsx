import { useState } from 'react';
import { ChevronRightIcon } from '@primer/octicons-react';
import type { Day, Exercise, Plan, SessionType } from '../schema';
import type { OverrideScope } from '../logSchema';
import type { ResolvedExercise } from '../plan';
import { commitOverride } from '../actions';
import { customExerciseId } from '../overrides';
import { useLogActions } from '../logContext';
import { Dialog } from './Dialog';
import { Segmented } from './Segmented';
import { numberText, parseNumber } from '../views/LogFrame';

type ScopeChoice = 'week' | 'from';

function ScopePicker({ week, value, onChange }: { week: number; value: ScopeChoice; onChange: (v: ScopeChoice) => void }) {
  return (
    <div className="box-row field field--stacked">
      <span className="field-label">Applies to</span>
      <Segmented
        label="Applies to"
        options={[
          { value: 'week', label: `Week ${week} only` },
          { value: 'from', label: `From week ${week} on` },
        ]}
        value={value}
        onChange={(v) => v && onChange(v)}
      />
    </div>
  );
}

const toScope = (choice: ScopeChoice, week: number): OverrideScope =>
  choice === 'week' ? { week } : { fromWeek: week };

/**
 * Edit an exercise (sets, reps, target kg, note) or replace it, for one week or from
 * that week on. Saves an override record; plan.json is never touched.
 */
export function ExerciseEditor({
  plan,
  week,
  type,
  exercise,
  lighterNote,
  onClose,
}: {
  plan: Plan;
  week: number;
  day: Day;
  type: SessionType;
  exercise: ResolvedExercise;
  /** Set when this week cuts sets, so the scope choice can explain what happens. */
  lighterNote?: string;
  onClose: () => void;
}) {
  const { notify } = useLogActions();
  const [mode, setMode] = useState<'edit' | 'replace'>('edit');
  const [scope, setScope] = useState<ScopeChoice>('from');
  const [error, setError] = useState('');

  // ---------- edit ----------
  const initial = {
    sets: String(exercise.originalSets),
    reps: exercise.reps,
    targetKg: numberText(exercise.targetKg),
    note: exercise.note ?? '',
  };
  const [form, setForm] = useState(initial);

  const saveEdit = () => {
    const changes: { sets?: number; reps?: string; targetKg?: number | null; note?: string } = {};
    const sets = Number(form.sets);
    if (!Number.isInteger(sets) || sets < 1 || sets > 12) return setError('Sets must be a whole number from 1 to 12.');
    if (!form.reps.trim()) return setError('Reps can’t be empty.');
    if (form.sets !== initial.sets) changes.sets = sets;
    if (form.reps.trim() !== initial.reps) changes.reps = form.reps.trim();
    if (form.targetKg.trim() !== initial.targetKg) {
      const kg = parseNumber(form.targetKg);
      if (form.targetKg.trim() && kg === null) return setError('Target kg must be a number.');
      changes.targetKg = kg;
    }
    if (form.note.trim() !== initial.note.trim()) changes.note = form.note.trim();
    if (Object.keys(changes).length === 0) return onClose();
    commitOverride({ kind: 'editExercise', scope: toScope(scope, week), sessionType: type, exerciseId: exercise.id, changes });
    notify(`${exercise.name} changed.`);
    onClose();
  };

  // ---------- replace ----------
  const slotBase = plan.templates[type].exercises?.find((e) => e.id === exercise.slotId);
  const options = (slotBase?.swaps ?? [])
    .map((id) => plan.exerciseLibrary.find((e) => e.id === id))
    .filter((e): e is Exercise => !!e && e.id !== exercise.id);
  const [custom, setCustom] = useState({ name: '', sets: '3', reps: '8', mainLift: false });

  const replaceWith = (ex: Exercise) => {
    commitOverride({ kind: 'replaceExercise', scope: toScope(scope, week), sessionType: type, exerciseId: exercise.slotId, with: ex });
    notify(`${exercise.name} replaced with ${ex.name}.`);
    onClose();
  };

  const saveCustom = () => {
    const name = custom.name.trim();
    const sets = Number(custom.sets);
    if (!name) return setError('Give the exercise a name.');
    if (!Number.isInteger(sets) || sets < 1 || sets > 12) return setError('Sets must be a whole number from 1 to 12.');
    if (!custom.reps.trim()) return setError('Reps can’t be empty.');
    replaceWith({
      id: customExerciseId(name),
      name,
      sets,
      reps: custom.reps.trim(),
      ...(custom.mainLift ? { mainLift: true } : {}),
    });
  };

  const footer = (
    <>
      <button className="btn" onClick={onClose}>
        Cancel
      </button>
      <button className="btn btn-primary" onClick={mode === 'edit' ? saveEdit : saveCustom}>
        {mode === 'edit' ? 'Save' : 'Use my exercise'}
      </button>
    </>
  );

  if (mode === 'replace') {
    return (
      <Dialog title={`Replace ${exercise.name.toLowerCase()}`} onClose={onClose} footer={footer}>
        <ScopePicker week={week} value={scope} onChange={setScope} />
        {options.length > 0 && (
          <ul>
            {options.map((ex) => (
              <li key={ex.id}>
                <button className="box-row option-row" onClick={() => replaceWith(ex)}>
                  <span className="option-name">
                    {ex.name}
                    <span className="text-muted text-small">
                      {' '}
                      {ex.sets} × {ex.reps}
                    </span>
                  </span>
                  <ChevronRightIcon className="text-muted" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="box-row box-row--note">{options.length ? 'Or type your own:' : 'Type the exercise to do instead:'}</p>
        <label className="box-row field">
          <span className="field-label">Name</span>
          <input
            className="input input--grow"
            value={custom.name}
            onChange={(e) => setCustom({ ...custom, name: e.target.value })}
          />
        </label>
        <label className="box-row field">
          <span className="field-label">Sets</span>
          <input
            className="input input--num"
            inputMode="numeric"
            value={custom.sets}
            onChange={(e) => setCustom({ ...custom, sets: e.target.value })}
          />
        </label>
        <label className="box-row field">
          <span className="field-label">Reps</span>
          <input
            className="input input--grow"
            value={custom.reps}
            onChange={(e) => setCustom({ ...custom, reps: e.target.value })}
          />
        </label>
        <label className="box-row field checkbox-field">
          <input
            type="checkbox"
            className="checkbox"
            checked={custom.mainLift}
            onChange={(e) => setCustom({ ...custom, mainLift: e.target.checked })}
          />
          <span>
            Main lift <span className="text-muted text-small">(follows the block rules for main lifts)</span>
          </span>
        </label>
        {error && <p className="box-row field-error">{error}</p>}
      </Dialog>
    );
  }

  return (
    <Dialog title={`Edit ${exercise.name.toLowerCase()}`} onClose={onClose} footer={footer}>
      <label className="box-row field">
        <span className="field-label">Sets</span>
        <input
          className="input input--num"
          inputMode="numeric"
          value={form.sets}
          onChange={(e) => setForm({ ...form, sets: e.target.value })}
        />
      </label>
      <label className="box-row field">
        <span className="field-label">Reps</span>
        <input className="input input--grow" value={form.reps} onChange={(e) => setForm({ ...form, reps: e.target.value })} />
      </label>
      <label className="box-row field">
        <span className="field-label">Target</span>
        <input
          className="input input--num"
          inputMode="decimal"
          placeholder="–"
          value={form.targetKg}
          onChange={(e) => setForm({ ...form, targetKg: e.target.value })}
        />
        <span className="text-muted text-small">kg</span>
      </label>
      <label className="box-row field">
        <span className="field-label">Note</span>
        <input className="input input--grow" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
      </label>
      <ScopePicker week={week} value={scope} onChange={setScope} />
      {lighterNote && <p className="box-row box-row--note">{lighterNote}</p>}
      {error && <p className="box-row field-error">{error}</p>}
      <div className="box-row">
        <button
          className="btn-invisible"
          onClick={() => {
            setError('');
            setMode('replace');
          }}
        >
          Replace with another exercise
        </button>
      </div>
    </Dialog>
  );
}
