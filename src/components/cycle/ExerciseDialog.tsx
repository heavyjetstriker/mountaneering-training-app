import { useState } from 'react';
import type { Exercise } from '../../schema';
import type { ExerciseFields } from '../../cycles';
import { numberText, parseNumber } from '../../views/LogFrame';
import { Dialog } from '../Dialog';

/**
 * Add or edit an exercise in a strength session, or a swap in the swap library.
 * Sets 1–12, reps as text ("5", "8 per leg", "30 s per side", "40 m").
 */
export function ExerciseDialog({
  exercise,
  library,
  isSwap = false,
  onSave,
  onDelete,
  onMove,
  canMove,
  onClose,
}: {
  /** null = a new one. */
  exercise: Exercise | null;
  /** Swaps this exercise can offer (not for swaps themselves). */
  library: Exercise[];
  isSwap?: boolean;
  onSave: (fields: ExerciseFields) => void;
  onDelete?: () => void;
  onMove?: (by: -1 | 1) => void;
  canMove?: { up: boolean; down: boolean };
  onClose: () => void;
}) {
  const [name, setName] = useState(exercise?.name ?? '');
  const [sets, setSets] = useState(String(exercise?.sets ?? 3));
  const [reps, setReps] = useState(exercise?.reps ?? '');
  const [targetKg, setTargetKg] = useState(numberText(exercise?.targetKg));
  const [mainLift, setMainLift] = useState(!!exercise?.mainLift);
  const [note, setNote] = useState(exercise?.note ?? '');
  const [swaps, setSwaps] = useState<string[]>(exercise?.swaps ?? []);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const what = isSwap ? 'swap' : 'exercise';

  const save = () => {
    const n = Number(sets);
    if (!name.trim()) return setError('Give it a name.');
    if (!Number.isInteger(n) || n < 1 || n > 12) return setError('Sets must be a whole number from 1 to 12.');
    if (!reps.trim()) return setError('Reps can’t be empty, e.g. 5, 8 per leg or 30 s.');
    const kg = targetKg.trim() ? parseNumber(targetKg) : null;
    if (targetKg.trim() && (kg === null || kg <= 0)) return setError('Target kg must be a number above 0.');
    onSave({
      name: name.trim(),
      sets: n,
      reps: reps.trim(),
      ...(kg !== null ? { targetKg: kg } : {}),
      ...(mainLift ? { mainLift } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(swaps.length && !isSwap ? { swaps } : {}),
    });
  };

  if (confirmDelete && onDelete) {
    return (
      <Dialog
        title={`Delete ${exercise?.name}?`}
        onClose={() => setConfirmDelete(false)}
        footer={
          <>
            <button className="btn" onClick={() => setConfirmDelete(false)}>
              Keep it
            </button>
            <button className="btn btn-danger" onClick={onDelete}>
              Delete
            </button>
          </>
        }
      >
        <p className="box-row text-muted">
          {isSwap ? 'It is no longer offered as a swap.' : 'It is taken out of this session.'} Logs keep what you did.
        </p>
      </Dialog>
    );
  }

  return (
    <Dialog
      title={exercise ? `Edit ${what}` : `Add ${what}`}
      onClose={onClose}
      footer={
        <>
          {exercise && onDelete && (
            <button className="btn-invisible btn-invisible--danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            {exercise ? 'Save' : 'Add'}
          </button>
        </>
      }
    >
      <label className="box-row field">
        <span className="field-label">Name</span>
        <input className="input input--grow" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </label>
      {!exercise && !isSwap && (
        <p className="box-row box-row--note">Use the same name as before (e.g. Back squat) and last time's weights carry over.</p>
      )}
      <label className="box-row field">
        <span className="field-label">Sets</span>
        <input className="input input--num" inputMode="numeric" value={sets} onChange={(e) => setSets(e.target.value)} />
      </label>
      <label className="box-row field">
        <span className="field-label">Reps</span>
        <input
          className="input input--grow"
          value={reps}
          placeholder="5, 8 per leg, 30 s"
          onChange={(e) => setReps(e.target.value)}
        />
      </label>
      {!isSwap && (
        <label className="box-row field">
          <span className="field-label">Target kg</span>
          <input
            className="input input--num"
            inputMode="decimal"
            value={targetKg}
            placeholder="–"
            onChange={(e) => setTargetKg(e.target.value)}
          />
        </label>
      )}
      <label className="box-row checkbox-field">
        <input type="checkbox" className="checkbox" checked={mainLift} onChange={(e) => setMainLift(e.target.checked)} />
        <span className="option-day">
          <span>Main lift</span>
          <span className="text-muted text-small">The cycle's main-lift rules apply to it (Rules).</span>
        </span>
      </label>
      <label className="box-row field field--stacked">
        <span className="field-label">Note</span>
        <input className="input input--grow" value={note} placeholder="e.g. 3 s down" onChange={(e) => setNote(e.target.value)} />
      </label>
      {!isSwap && library.length > 0 && (
        <div className="box-row field field--stacked">
          <span className="field-label">Swaps offered</span>
          {library.map((l) => (
            <label key={l.id} className="radio-option">
              <input
                type="checkbox"
                className="checkbox"
                checked={swaps.includes(l.id)}
                onChange={(e) => setSwaps(e.target.checked ? [...swaps, l.id] : swaps.filter((s) => s !== l.id))}
              />
              <span>
                {l.name} <span className="text-muted">{l.sets} × {l.reps}</span>
              </span>
            </label>
          ))}
        </div>
      )}
      {onMove && canMove && (
        <div className="box-row button-row">
          <button className="btn" disabled={!canMove.up} onClick={() => onMove(-1)}>
            Move up
          </button>
          <button className="btn" disabled={!canMove.down} onClick={() => onMove(1)}>
            Move down
          </button>
        </div>
      )}
      {error && <p className="box-row field-error">{error}</p>}
    </Dialog>
  );
}
