import { useEffect, useMemo, useState } from 'react';
import { ArrowSwitchIcon, CheckIcon, DashIcon, PlusIcon } from '@primer/octicons-react';
import type { Exercise, Plan } from '../schema';
import type { LoggedSet, SessionLog, SetUnit } from '../logSchema';
import { resolveSession, resolveSwap } from '../plan';
import { useWeekContext } from '../useWeekContext';
import { lastSetsFor, lastTimeText, logFor, parseReps, prefillSets, UNIT_LABEL, upsertLog, deleteLog } from '../logs';
import { getStore, newId, useAppData } from '../store';
import { clearDraft, readDraft, writeDraft, StrengthFormSchema, type StrengthForm } from '../drafts';
import type { LogTarget } from '../logContext';
import { Dialog } from '../components/Dialog';
import { Segmented } from '../components/Segmented';
import { LogFrame, numberText, parseNumber } from './LogFrame';
import { RestTimer } from '../components/RestTimer';

type Row = StrengthForm['boxes'][number]['rows'][number];
type ResolvedExercise = Exercise & { originalSets: number };

const KG_STEP = 2.5;
const ORPHAN = 'orphan:';

/** What a box is showing: the planned exercise, its swap, or a logged exercise no longer in the plan. */
interface BoxInfo {
  name: string;
  dose: string;
  unit: SetUnit;
  reps: string;
  planned?: ResolvedExercise;
  current?: ResolvedExercise;
}

function emptyRows(n: number): Row[] {
  return Array.from({ length: n }, () => ({ reps: '', kg: '' }));
}

function prefillRows(ex: ResolvedExercise, logs: SessionLog[], date: string): Row[] {
  return prefillSets(ex, ex.sets, logs, date).map((r) => ({ reps: numberText(r.reps), kg: numberText(r.kg) }));
}

function step(kg: string, delta: number): string {
  const n = parseNumber(kg) ?? 0;
  return numberText(Math.max(0, Math.round((n + delta) * 100) / 100));
}

export function StrengthLog({ plan, target, onClose }: { plan: Plan; target: LogTarget; onClose: (saved?: string) => void }) {
  const data = useAppData();
  const { date, week, day, type } = target;
  const ctx = useWeekContext(plan, week);
  const session = useMemo(() => resolveSession(plan, week, day, type, ctx), [plan, week, day, type, ctx]);
  const planned = useMemo(() => new Map((session.exercises ?? []).map((e) => [e.id, e])), [session]);
  // Frozen when the screen opens, so saving doesn't reshuffle what's on screen.
  const [existing] = useState(() => logFor(data.logs, date, type));
  const [logs] = useState(() => data.logs);

  const resolveCurrent = (plannedId: string, exerciseId: string): ResolvedExercise | undefined =>
    exerciseId === plannedId ? planned.get(plannedId) : resolveSwap(plan, week, day, type, exerciseId, ctx) ?? undefined;

  // ---------- starting form: the saved log, or the prefill ----------
  const [base] = useState<StrengthForm>(() => {
    if (existing && existing.status !== 'skipped') {
      const sets = existing.sets ?? [];
      const boxes: StrengthForm['boxes'] = (session.exercises ?? []).map((p) => {
        const exerciseId = existing.swaps?.[p.id] ?? p.id;
        const mine = sets.filter((s) => s.exerciseId === exerciseId).sort((a, b) => a.setNumber - b.setNumber);
        const ex = resolveCurrent(p.id, exerciseId);
        return {
          plannedId: p.id,
          exerciseId,
          rows: mine.length
            ? mine.map((s) => ({ reps: numberText(s.reps), kg: numberText(s.kg) }))
            : emptyRows(ex?.sets ?? p.sets),
        };
      });
      // Keep sets of exercises that are no longer in the plan, so re-saving never loses them.
      const shown = new Set(boxes.map((b) => b.exerciseId));
      for (const id of [...new Set(sets.map((s) => s.exerciseId))].filter((i) => !shown.has(i))) {
        const mine = sets.filter((s) => s.exerciseId === id).sort((a, b) => a.setNumber - b.setNumber);
        boxes.push({
          plannedId: ORPHAN + id,
          exerciseId: id,
          rows: mine.map((s) => ({ reps: numberText(s.reps), kg: numberText(s.kg) })),
        });
      }
      return {
        boxes,
        note: existing.note ?? '',
        status: existing.status === 'partial' ? 'partial' : 'done',
        minutes: numberText(existing.minutes),
      };
    }
    return {
      boxes: (session.exercises ?? []).map((p) => ({ plannedId: p.id, exerciseId: p.id, rows: prefillRows(p, logs, date) })),
      note: '',
      status: 'done',
      minutes: '',
    };
  });

  // A draft left from earlier wins, if it still fits this session.
  const [restored] = useState(() => {
    const d = readDraft(date, type);
    const ok =
      d &&
      StrengthFormSchema.safeParse(d).success &&
      d.boxes.length === base.boxes.length &&
      d.boxes.every((b, i) => b.plannedId === base.boxes[i].plannedId);
    return ok ? d : null;
  });
  const [form, setForm] = useState<StrengthForm>(restored ?? base);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(base);

  useEffect(() => {
    if (dirty) writeDraft(date, type, form);
    else clearDraft(date, type);
  }, [form, dirty, date, type]);

  // Logged sets for exercises no longer in the plan.
  const orphanInfo = (id: string): BoxInfo => {
    const s = existing?.sets?.find((x) => x.exerciseId === id);
    const unit = s?.unit ?? 'reps';
    const n = existing?.sets?.filter((x) => x.exerciseId === id).length ?? 0;
    return { name: s?.exerciseName ?? id, dose: `${n} ${n === 1 ? 'set' : 'sets'} logged`, unit, reps: '' };
  };

  const infoFor = (b: StrengthForm['boxes'][number]): BoxInfo => {
    if (b.plannedId.startsWith(ORPHAN)) return orphanInfo(b.exerciseId);
    const p = planned.get(b.plannedId)!;
    const cur = resolveCurrent(b.plannedId, b.exerciseId) ?? p;
    return { name: cur.name, dose: `${cur.sets} × ${cur.reps}`, unit: parseReps(cur.reps).unit, reps: cur.reps, planned: p, current: cur };
  };

  // ---------- editing ----------
  const updateBox = (i: number, change: (b: StrengthForm['boxes'][number]) => StrengthForm['boxes'][number]) =>
    setForm((f) => ({ ...f, boxes: f.boxes.map((b, j) => (j === i ? change(b) : b)) }));
  const updateRow = (i: number, r: number, change: Partial<Row>) =>
    updateBox(i, (b) => ({ ...b, rows: b.rows.map((row, k) => (k === r ? { ...row, ...change } : row)) }));

  const chooseSwap = (plannedId: string, exerciseId: string) => {
    const i = form.boxes.findIndex((b) => b.plannedId === plannedId);
    const ex = resolveCurrent(plannedId, exerciseId);
    if (i >= 0 && ex) updateBox(i, () => ({ plannedId, exerciseId, rows: prefillRows(ex, logs, date) }));
    setSwapFor(null);
  };

  // ---------- saving ----------
  const save = () => {
    const sets: LoggedSet[] = [];
    const swaps: Record<string, string> = {};
    let incomplete = false;
    for (const b of form.boxes) {
      const info = infoFor(b);
      if (info.planned && b.exerciseId !== b.plannedId) swaps[b.plannedId] = b.exerciseId;
      let n = 0;
      for (const row of b.rows) {
        const reps = parseNumber(row.reps);
        if (reps === null || reps === 0) {
          incomplete = true; // empty rows are dropped and the session counts as partly done
          continue;
        }
        sets.push({
          exerciseId: b.exerciseId,
          exerciseName: info.name,
          setNumber: ++n,
          reps,
          unit: info.unit,
          kg: parseNumber(row.kg),
        });
      }
    }
    const note = form.note.trim();
    const minutes = parseNumber(form.minutes ?? '');
    const log: SessionLog = {
      id: existing?.id ?? newId(),
      date,
      week,
      type,
      status: incomplete || sets.length === 0 ? 'partial' : form.status,
      sets,
      ...(Object.keys(swaps).length ? { swaps } : {}),
      ...(note ? { note } : {}),
      ...(minutes !== null && minutes > 0 ? { minutes: Math.round(minutes) } : {}),
      savedAt: new Date().toISOString(),
    };
    const store = getStore();
    if (store.save(upsertLog(store.getState().data, log))) {
      clearDraft(date, type);
      onClose(`${session.title} saved.`);
    } else {
      onClose();
    }
  };

  const remove = () => {
    if (!existing) return;
    const store = getStore();
    store.save(deleteLog(store.getState().data, existing.id));
    clearDraft(date, type);
    onClose(`${session.title} log deleted.`);
  };

  const swapBox = swapFor ? form.boxes.find((b) => b.plannedId === swapFor) : undefined;
  const swapPlanned = swapFor ? planned.get(swapFor) : undefined;

  return (
    <LogFrame
      title={session.title}
      date={date}
      dirty={dirty}
      canDelete={!!existing}
      onSave={save}
      onDiscard={() => {
        clearDraft(date, type);
        onClose();
      }}
      onDelete={remove}
      bar={<RestTimer />}
    >
      {restored && <p className="text-muted text-small">Restored your unsaved log from earlier.</p>}

      {form.boxes.map((b, i) => {
        const info = infoFor(b);
        const swapped = info.planned && b.exerciseId !== b.plannedId;
        return (
          <article className="box" key={b.plannedId}>
            <header className="box-header">
              <div className="log-ex-head">
                <h2 className="box-title">{info.name}</h2>
                <span className="text-muted text-small">{info.dose}</span>
              </div>
              {info.planned?.swaps?.length ? (
                <button className="btn-invisible" onClick={() => setSwapFor(b.plannedId)}>
                  <ArrowSwitchIcon /> Swap
                </button>
              ) : null}
            </header>
            <p className="box-row box-row--note">
              {swapped && <>Instead of {info.planned!.name}. </>}
              {lastTimeText(lastSetsFor(logs, b.exerciseId, date))}
              {info.current?.targetKg !== undefined && <> Target {numberText(info.current.targetKg)} kg.</>}
            </p>
            <div className="box-row set-row set-head text-muted text-small" aria-hidden="true">
              <span>Set</span>
              <span>{UNIT_LABEL[info.unit]}</span>
              <span className="set-kg-head">Kg</span>
            </div>
            {b.rows.map((row, r) => (
              <div className="box-row set-row" key={r}>
                <span className="set-label">{r + 1}</span>
                <input
                  className="input input--num"
                  inputMode="numeric"
                  enterKeyHint="next"
                  aria-label={`${info.name}, set ${r + 1}, ${UNIT_LABEL[info.unit].toLowerCase()}`}
                  value={row.reps}
                  onChange={(e) => updateRow(i, r, { reps: e.target.value })}
                />
                <div className="stepper">
                  <button
                    className="btn btn-icon"
                    aria-label={`${KG_STEP} kg less, set ${r + 1}`}
                    onClick={() => updateRow(i, r, { kg: step(row.kg, -KG_STEP) })}
                  >
                    <DashIcon />
                  </button>
                  <input
                    className="input input--num"
                    inputMode="decimal"
                    enterKeyHint="next"
                    aria-label={`${info.name}, set ${r + 1}, kg`}
                    placeholder="–"
                    value={row.kg}
                    onChange={(e) => updateRow(i, r, { kg: e.target.value })}
                  />
                  <button
                    className="btn btn-icon"
                    aria-label={`${KG_STEP} kg more, set ${r + 1}`}
                    onClick={() => updateRow(i, r, { kg: step(row.kg, KG_STEP) })}
                  >
                    <PlusIcon />
                  </button>
                </div>
              </div>
            ))}
            <div className="box-row set-actions">
              <button
                className="btn-invisible btn-invisible--muted"
                disabled={b.rows.length <= 1}
                onClick={() => updateBox(i, (x) => ({ ...x, rows: x.rows.slice(0, -1) }))}
              >
                Remove last set
              </button>
              <button
                className="btn-invisible"
                onClick={() =>
                  updateBox(i, (x) => ({ ...x, rows: [...x.rows, { ...(x.rows[x.rows.length - 1] ?? { reps: '', kg: '' }) }] }))
                }
              >
                <PlusIcon /> Add set
              </button>
            </div>
          </article>
        );
      })}

      <div className="box">
        <label className="box-row field">
          <span className="field-label">Minutes</span>
          <input
            className="input input--num"
            inputMode="numeric"
            value={form.minutes ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, minutes: e.target.value }))}
          />
          <span className="text-muted text-small">optional</span>
        </label>
        <label className="box-row field field--stacked">
          <span className="field-label">Note</span>
          <textarea
            className="input textarea"
            rows={2}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
        </label>
        <div className="box-row field">
          <span className="field-label" id="strength-status">
            Status
          </span>
          <Segmented
            label="Status"
            options={[
              { value: 'done', label: 'Done' },
              { value: 'partial', label: 'Partly done' },
            ]}
            value={form.status}
            onChange={(v) => v && setForm((f) => ({ ...f, status: v }))}
          />
        </div>
      </div>

      {swapFor && swapPlanned && swapBox && (
        <Dialog title={`Swap ${swapPlanned.name.toLowerCase()}`} onClose={() => setSwapFor(null)}>
          <p className="box-row box-row--note">For this session only.</p>
          <ul>
            {(swapPlanned.swaps ?? []).map((id) => {
              const ex = resolveSwap(plan, week, day, type, id, ctx);
              if (!ex) return null;
              return (
                <li key={id}>
                  <button className="box-row option-row" onClick={() => chooseSwap(swapFor, id)}>
                    <span className="option-name">
                      {ex.name}
                      <span className="text-muted text-small"> {ex.sets} × {ex.reps}</span>
                    </span>
                    {swapBox.exerciseId === id && <CheckIcon className="text-accent" aria-label="In use" />}
                  </button>
                </li>
              );
            })}
            {swapBox.exerciseId !== swapFor && (
              <li>
                <button className="box-row option-row" onClick={() => chooseSwap(swapFor, swapFor)}>
                  <span className="option-name">
                    Use the planned exercise
                    <span className="text-muted text-small">
                      {' '}
                      {swapPlanned.name}, {swapPlanned.sets} × {swapPlanned.reps}
                    </span>
                  </span>
                </button>
              </li>
            )}
          </ul>
        </Dialog>
      )}
    </LogFrame>
  );
}
