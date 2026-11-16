import { useMemo, useState } from 'react';
import type { Plan } from '../schema';
import type { EffortZone, SessionLog } from '../logSchema';
import { getWeek, resolveSession } from '../plan';
import { cardioPrefill, deleteLog, logFor, logKind, upsertLog } from '../logs';
import { getStore, newId, useAppData } from '../store';
import type { LogTarget } from '../logContext';
import { Segmented } from '../components/Segmented';
import { LogFrame, numberText, parseNumber } from './LogFrame';

interface Form {
  minutes: string;
  avgHr: string;
  packKg: string;
  effortZone: EffortZone | null;
  note: string;
  status: 'done' | 'partial';
}

const ZONES: { value: EffortZone; label: string; ariaLabel: string }[] = ([1, 2, 3, 4, 5] as const).map((z) => ({
  value: z,
  label: `Z${z}`,
  ariaLabel: `Zone ${z}`,
}));

/** Log screen for Zone 2, Thursday, hikes, recovery and the test sessions. */
export function CardioLog({ plan, target, onClose }: { plan: Plan; target: LogTarget; onClose: (saved?: string) => void }) {
  const data = useAppData();
  const { date, week, day, type } = target;
  const session = useMemo(() => resolveSession(plan, week, day, type), [plan, week, day, type]);
  const isTest = logKind(type) === 'test';
  const prefill = useMemo(() => cardioPrefill(session, getWeek(plan, week), day), [session, plan, week, day]);
  const [existing] = useState(() => logFor(data.logs, date, type));

  const [base] = useState<Form>(() => {
    if (existing && existing.status !== 'skipped') {
      return {
        minutes: numberText(existing.minutes),
        avgHr: numberText(existing.avgHr),
        packKg: numberText(existing.packKg),
        effortZone: existing.effortZone ?? null,
        note: existing.note ?? '',
        status: existing.status === 'partial' ? 'partial' : 'done',
      };
    }
    return {
      minutes: numberText(prefill.minutes),
      avgHr: '',
      packKg: isTest ? '' : numberText(prefill.packKg),
      effortZone: isTest ? null : prefill.effortZone,
      note: '',
      status: 'done',
    };
  });
  const [form, setForm] = useState<Form>(base);
  const dirty = JSON.stringify(form) !== JSON.stringify(base);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    const minutes = parseNumber(form.minutes);
    const avgHr = isTest ? null : parseNumber(form.avgHr);
    const packKg = isTest ? null : parseNumber(form.packKg);
    const note = form.note.trim();
    const log: SessionLog = {
      id: existing?.id ?? newId(),
      date,
      week,
      type,
      status: form.status,
      ...(minutes !== null ? { minutes } : {}),
      ...(avgHr !== null ? { avgHr } : {}),
      ...(packKg !== null ? { packKg } : {}),
      ...(!isTest && form.effortZone ? { effortZone: form.effortZone } : {}),
      ...(note ? { note } : {}),
      savedAt: new Date().toISOString(),
    };
    const store = getStore();
    onClose(store.save(upsertLog(store.getState().data, log)) ? `${session.title} saved.` : undefined);
  };

  const remove = () => {
    if (!existing) return;
    const store = getStore();
    store.save(deleteLog(store.getState().data, existing.id));
    onClose(`${session.title} log deleted.`);
  };

  return (
    <LogFrame
      title={session.title}
      date={date}
      dirty={dirty}
      canDelete={!!existing}
      onSave={save}
      onDiscard={() => onClose()}
      onDelete={remove}
    >
      {session.target && <p className="text-muted">Planned: {session.target}</p>}
      {session.cardio && (
        <p className="text-muted">
          Planned: {session.cardio.minutes[0]}–{session.cardio.minutes[1]} min, {session.cardio.zone}
        </p>
      )}

      <div className="box">
        <label className="box-row field">
          <span className="field-label">Minutes</span>
          <input
            className="input input--num"
            inputMode="numeric"
            value={form.minutes}
            onChange={(e) => set('minutes', e.target.value)}
          />
        </label>
        {!isTest && (
          <>
            <label className="box-row field">
              <span className="field-label">Average HR</span>
              <input
                className="input input--num"
                inputMode="numeric"
                value={form.avgHr}
                onChange={(e) => set('avgHr', e.target.value)}
              />
              <span className="text-muted text-small">bpm</span>
            </label>
            <label className="box-row field">
              <span className="field-label">Pack</span>
              <input
                className="input input--num"
                inputMode="decimal"
                value={form.packKg}
                onChange={(e) => set('packKg', e.target.value)}
              />
              <span className="text-muted text-small">kg</span>
            </label>
            <div className="box-row field field--stacked">
              <span className="field-label">Effort zone</span>
              <Segmented label="Effort zone" options={ZONES} value={form.effortZone} onChange={(v) => set('effortZone', v)} allowNone />
            </div>
          </>
        )}
        <label className="box-row field field--stacked">
          <span className="field-label">Note</span>
          <textarea
            className="input textarea"
            rows={2}
            placeholder={prefill.notePlaceholder}
            value={form.note}
            onChange={(e) => set('note', e.target.value)}
          />
        </label>
        <div className="box-row field">
          <span className="field-label">Status</span>
          <Segmented
            label="Status"
            options={[
              { value: 'done', label: 'Done' },
              { value: 'partial', label: 'Partly done' },
            ]}
            value={form.status}
            onChange={(v) => v && set('status', v)}
          />
        </div>
      </div>

      {isTest && <p className="text-muted text-small">Enter test results in the Tests tab (milestone 5).</p>}
    </LogFrame>
  );
}
