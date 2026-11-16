import { useMemo, useState } from 'react';
import type { Plan } from '../schema';
import type { AppData, TestResult, TestType } from '../logSchema';
import { addDays, isValidISO, shortDate } from '../dates';
import { getStore, newId, useAppData } from '../store';
import { logFor, upsertLog } from '../logs';
import type { TestFormTarget } from '../logContext';
import {
  aerobicThreshold,
  deleteTest,
  driftPassed,
  driftPct,
  DRIFT_LIMIT,
  GAP_LIMIT,
  pctText,
  round1,
  sortResults,
  TEST_TITLES,
  thresholdGap,
  upsertTest,
  VERTICAL_MINUTES,
  VERTICAL_PACK_KG,
  verticalChangeText,
  verticalImproved,
  zone2Range,
} from '../tests';
import { Segmented } from '../components/Segmented';
import { LogFrame, numberText, parseNumber, type FrameWords } from './LogFrame';


type Fields = Record<string, string>;

const FIELDS: Record<TestType, { key: string; label: string; unit: string; decimal?: boolean }[]> = {
  drift: [
    { key: 'startHr', label: 'Starting HR', unit: 'bpm' },
    { key: 'hrFirstHalf', label: 'First 30 min average HR', unit: 'bpm' },
    { key: 'hrSecondHalf', label: 'Second 30 min average HR', unit: 'bpm' },
  ],
  threshold: [{ key: 'thresholdHr', label: 'Threshold HR (30 min average)', unit: 'bpm' }],
  vertical: [
    { key: 'verticalM', label: 'Vertical metres', unit: 'm' },
    { key: 'avgHr', label: 'Average HR', unit: 'bpm' },
    { key: 'minutes', label: 'Minutes', unit: 'min' },
    { key: 'packKg', label: 'Pack', unit: 'kg', decimal: true },
  ],
};

const OPTIONAL = new Set(['minutes', 'packKg']);

/** Checks one field; returns the number or an error message. Empty optional fields give null. */
function check(key: string, text: string): { value: number | null; error?: string } {
  const n = parseNumber(text);
  if (text.trim() === '') return OPTIONAL.has(key) ? { value: null } : { value: null, error: 'Required' };
  const whole = n !== null && Number.isInteger(n);
  if (key === 'verticalM') return whole && n >= 1 && n <= 5000 ? { value: n } : { value: null, error: 'Whole metres, 1 to 5000' };
  if (key === 'minutes') return whole && n >= 1 && n <= 600 ? { value: n } : { value: null, error: 'Whole minutes, 1 to 600' };
  if (key === 'packKg')
    return n !== null && n <= 40 && round1(n) === n ? { value: n } : { value: null, error: 'Pack between 0 and 40 kg' };
  return whole && n >= 60 && n <= 230 ? { value: n } : { value: null, error: 'Heart rate between 60 and 230' };
}

function emptyFields(type: TestType): Fields {
  const f: Fields = { note: '' };
  for (const { key } of FIELDS[type]) f[key] = '';
  if (type === 'vertical') {
    f.minutes = String(VERTICAL_MINUTES);
    f.packKg = String(VERTICAL_PACK_KG);
  }
  return f;
}

function fieldsOf(t: TestResult): Fields {
  const f = emptyFields(t.type);
  for (const { key } of FIELDS[t.type]) f[key] = numberText((t as unknown as Record<string, number | undefined>)[key]);
  f.note = t.note ?? '';
  return f;
}

/** A section is untouched when nothing but the plan's prefilled conditions is in it. */
function untouched(type: TestType, f: Fields): boolean {
  const blank = emptyFields(type);
  return FIELDS[type].every(({ key }) => f[key].trim() === blank[key]) && f.note.trim() === '';
}

function build(type: TestType, f: Fields, base: { id: string; date: string; savedAt: string }): TestResult | null {
  const v: Record<string, number> = {};
  for (const { key } of FIELDS[type]) {
    const r = check(key, f[key]);
    if (r.error) return null;
    if (r.value !== null) v[key] = r.value;
  }
  const note = f.note.trim();
  return { ...base, type, ...v, ...(note ? { note } : {}) } as TestResult;
}

/** The live line under a section, as I type. */
function liveText(type: TestType, f: Fields, others: TestResult[], date: string, formDrift: TestResult | null) {
  const num = (k: string) => check(k, f[k]).value;
  if (type === 'drift') {
    const a = num('hrFirstHalf');
    const b = num('hrSecondHalf');
    if (a === null || b === null) return null;
    const halves = { hrFirstHalf: a, hrSecondHalf: b };
    if (!driftPassed(halves))
      return { tone: 'attention', text: `Drift ${pctText(driftPct(halves))}. Repeat another day a few beats lower.` };
    const start = num('startHr');
    if (start === null) return { tone: 'success', text: `Drift ${pctText(driftPct(halves))}. Under ${DRIFT_LIMIT}%.` };
    const [lo, hi] = zone2Range(start);
    return {
      tone: 'success',
      text: `Drift ${pctText(driftPct(halves))}. Under ${DRIFT_LIMIT}%: your aerobic threshold is ${start} bpm, Zone 2 ${lo}–${hi} bpm.`,
    };
  }
  if (type === 'threshold') {
    const thr = num('thresholdHr');
    if (thr === null) return null;
    const pool = formDrift ? [...others, formDrift] : others;
    const at = aerobicThreshold(pool, addDays(date, 1));
    if (!at) return { tone: 'muted', text: 'Add a drift test under 5% to work out your threshold gap.' };
    const gap = thresholdGap(at.hr, thr);
    return round1(gap) <= GAP_LIMIT
      ? { tone: 'success', text: `Gap ${pctText(gap)}: intervals on.` }
      : { tone: 'muted', text: `Gap ${pctText(gap)}: intervals stay off.` };
  }
  const m = num('verticalM');
  const hr = num('avgHr');
  if (m === null || hr === null) return null;
  const first = sortResults(others).find((t) => t.type === 'vertical' && t.date <= date);
  if (!first || first.type !== 'vertical') return null;
  const c = { metres: m - first.verticalM, hr: hr - first.avgHr };
  return {
    tone: verticalImproved(c) ? 'success' : 'muted',
    text: `${verticalChangeText(c)} than your first test (${shortDate(first.date)}).`,
  };
}

const WORDS: FrameWords = {
  save: 'Save results',
  delete: 'Delete result',
  discardTitle: 'Discard these results?',
  deleteTitle: 'Delete this result?',
  deleteBody: 'It is removed from your history, and your Zone 2 range and intervals are worked out again.',
};

const TYPE_OPTIONS = (['drift', 'threshold', 'vertical'] as const).map((t) => ({
  value: t,
  label: TEST_TITLES[t].replace(' test', ''),
}));

/** Full-screen form for drift, threshold and vertical results. */
export function TestForm({
  plan,
  target,
  onClose,
}: {
  plan: Plan;
  target: TestFormTarget;
  onClose: (saved?: string) => void;
}) {
  const data = useAppData();
  const [editing] = useState(() => (target.editId ? data.tests.find((t) => t.id === target.editId) : undefined));
  const fromTab = !target.session && !editing;

  const [base] = useState(() => {
    const sections = {} as Record<TestType, Fields>;
    for (const t of ['drift', 'threshold', 'vertical'] as const) sections[t] = emptyFields(t);
    if (editing) sections[editing.type] = fieldsOf(editing);
    return {
      pick: (editing?.type ?? target.types[0]) as TestType,
      date: editing?.date ?? target.date,
      sections,
    };
  });
  const [form, setForm] = useState(base);
  const [tried, setTried] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(base);

  const types: TestType[] = editing ? [editing.type] : fromTab ? [form.pick] : target.types;
  const others = useMemo(() => data.tests.filter((t) => t.id !== editing?.id), [data.tests, editing]);
  const dateOk = isValidISO(form.date);

  const setField = (type: TestType, key: string, value: string) =>
    setForm((f) => ({ ...f, sections: { ...f.sections, [type]: { ...f.sections[type], [key]: value } } }));

  // Which sections to save: every shown one, except untouched ones when there are several.
  const toSave = types.filter((t) => types.length === 1 || !untouched(t, form.sections[t]));
  const nothing = toSave.length === 0;

  const formDrift =
    types.includes('drift') && dateOk
      ? build('drift', form.sections.drift, { id: 'live', date: form.date, savedAt: '' })
      : null;

  const save = () => {
    setTried(true);
    if (!dateOk || nothing) return;
    const now = new Date().toISOString();
    const results = toSave.map((t) =>
      build(t, form.sections[t], { id: editing?.id ?? newId(), date: form.date, savedAt: editing?.savedAt ?? now }),
    );
    if (results.some((r) => r === null)) return;
    const store = getStore();
    let next: AppData = store.getState().data;
    for (const r of results) next = upsertTest(next, r!);
    // From a test session: tick it off too, unless it's already logged.
    const s = target.session;
    if (s && !logFor(next.logs, s.date, s.type)) {
      next = upsertLog(next, { id: newId(), date: s.date, week: s.week, type: s.type, status: 'done', savedAt: now });
    }
    if (!store.save(next)) return onClose();
    const names = results.map((r) => TEST_TITLES[r!.type]);
    onClose(
      names.length === 1
        ? `${names[0]} saved.`
        : `${names.slice(0, -1).map((n) => n.replace(' test', '')).join(', ')} and ${names[names.length - 1].toLowerCase().replace(' test', '')} tests saved.`,
    );
  };

  const remove = () => {
    if (!editing) return;
    const store = getStore();
    store.save(deleteTest(store.getState().data, editing.id));
    onClose('Test deleted.');
  };

  const title = editing
    ? `Edit ${TEST_TITLES[editing.type].toLowerCase()}`
    : target.session
      ? plan.templates[target.session.type].title
      : 'Add a test result';

  return (
    <LogFrame
      title={title}
      date={dateOk ? form.date : base.date}
      dirty={dirty}
      canDelete={!!editing}
      onSave={save}
      onDiscard={() => onClose()}
      onDelete={remove}
      words={WORDS}
    >
      {(fromTab || editing) && (
        <div className="box">
          {fromTab && (
            <div className="box-row field field--stacked">
              <span className="field-label">Test</span>
              <Segmented
                label="Test"
                options={TYPE_OPTIONS}
                value={form.pick}
                onChange={(v) => v && setForm((f) => ({ ...f, pick: v }))}
              />
            </div>
          )}
          <label className="box-row field">
            <span className="field-label">Date</span>
            <input
              className="input input--grow"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </label>
          {tried && !dateOk && <p className="box-row field-error">Pick a date.</p>}
        </div>
      )}

      {target.session && types.length > 1 && (
        <p className="text-muted text-small">Fill in either test, or both.</p>
      )}

      {types.map((type) => {
        const f = form.sections[type];
        const live = dateOk ? liveText(type, f, others, form.date, type === 'threshold' ? formDrift : null) : null;
        const showErrors = tried && toSave.includes(type);
        return (
          <section className="box" key={type} aria-label={TEST_TITLES[type]}>
            <header className="box-header">
              <h2 className="box-title">{TEST_TITLES[type]}</h2>
            </header>
            {FIELDS[type].map(({ key, label, unit, decimal }) => {
              const err = showErrors ? check(key, f[key]).error : undefined;
              return (
                <div className="box-row field-block" key={key}>
                  <label className="field">
                    <span className="field-label field-label--wide">{label}</span>
                    <input
                      className="input input--num"
                      inputMode={decimal ? 'decimal' : 'numeric'}
                      value={f[key]}
                      aria-invalid={err ? true : undefined}
                      onChange={(e) => setField(type, key, e.target.value)}
                    />
                    <span className="text-muted text-small">{unit}</span>
                  </label>
                  {err && <span className="field-error">{err}</span>}
                </div>
              );
            })}
            <label className="box-row field field--stacked">
              <span className="field-label">Note</span>
              <textarea
                className="input textarea"
                rows={2}
                value={f.note}
                onChange={(e) => setField(type, 'note', e.target.value)}
              />
            </label>
            {live && <p className={`box-row live-result live-result--${live.tone}`}>{live.text}</p>}
          </section>
        );
      })}

      {tried && nothing && <p className="field-error">Fill in at least one test.</p>}
      {target.session && !logFor(data.logs, target.session.date, target.session.type) && (
        <p className="text-muted text-small">Saving also marks the session as done.</p>
      )}
    </LogFrame>
  );
}
