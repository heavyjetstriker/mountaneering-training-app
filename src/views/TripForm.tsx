import { useState } from 'react';
import type { Plan } from '../schema';
import { AREAS, type AppData, type Trip } from '../logSchema';
import { isValidISO } from '../dates';
import { getStore, newId, useAppData } from '../store';
import type { TripFormTarget } from '../logContext';
import { defaultStatus, deleteTrip, normalizeLink, packPrefill, upsertTrip } from '../trips';
import { Segmented } from '../components/Segmented';
import { LogFrame, numberText, parseNumber, type FrameWords } from './LogFrame';

interface Form {
  date: string;
  route: string;
  area: Trip['area'];
  transport: Trip['transport'];
  distanceKm: string;
  climbM: string;
  packKg: string;
  link: string;
  note: string;
  status: Trip['status'];
}

type Errors = Partial<Record<keyof Form, string>>;

const WORDS: FrameWords = {
  save: 'Save trip',
  delete: 'Delete trip',
  discardTitle: 'Discard this trip?',
  deleteTitle: 'Delete this trip?',
  deleteBody: 'It is removed from your trips.',
};

const oneDecimal = (n: number) => Math.round(n * 10) / 10 === n;

/** Checks the form; returns the trip fields or the errors to show next to each field. */
function validate(f: Form): { ok: true; fields: Omit<Trip, 'id' | 'savedAt'> } | { ok: false; errors: Errors } {
  const errors: Errors = {};
  if (!isValidISO(f.date)) errors.date = 'Pick a date';
  const route = f.route.trim();
  if (!route) errors.route = 'Add the route';
  else if (route.length > 120) errors.route = 'Keep it under 120 characters';

  const opt = (text: string) => (text.trim() === '' ? undefined : parseNumber(text));
  const km = opt(f.distanceKm);
  if (km === null || (km !== undefined && (km < 0.1 || km > 100 || !oneDecimal(km))))
    errors.distanceKm = 'Distance between 0.1 and 100 km';
  const climb = opt(f.climbM);
  if (climb === null || (climb !== undefined && (!Number.isInteger(climb) || climb > 5000)))
    errors.climbM = 'Whole metres, 0 to 5000';
  const pack = opt(f.packKg);
  if (pack === null || (pack !== undefined && (pack > 40 || !oneDecimal(pack)))) errors.packKg = 'Pack between 0 and 40 kg';
  const link = normalizeLink(f.link);
  if (!link.ok) errors.link = "That isn't a web link";

  if (Object.keys(errors).length || !link.ok) return { ok: false, errors };
  const note = f.note.trim();
  return {
    ok: true,
    fields: {
      date: f.date,
      route,
      area: f.area,
      transport: f.transport,
      status: f.status,
      ...(km !== undefined && km !== null ? { distanceKm: km } : {}),
      ...(climb !== undefined && climb !== null ? { climbM: climb } : {}),
      ...(pack !== undefined && pack !== null ? { packKg: pack } : {}),
      ...(link.url ? { link: link.url } : {}),
      ...(note ? { note } : {}),
    },
  };
}

/** Full-screen form to add or edit a trip. */
export function TripForm({
  plan,
  today,
  target,
  onClose,
}: {
  plan: Plan;
  today: string;
  target: TripFormTarget;
  onClose: (saved?: string) => void;
}) {
  const data = useAppData();
  const [editing] = useState(() => (target.editId ? data.trips.find((t) => t.id === target.editId) : undefined));

  const [base] = useState<Form>(() =>
    editing
      ? {
          date: editing.date,
          route: editing.route,
          area: editing.area,
          transport: editing.transport,
          distanceKm: numberText(editing.distanceKm),
          climbM: numberText(editing.climbM),
          packKg: numberText(editing.packKg),
          link: editing.link ?? '',
          note: editing.note ?? '',
          status: editing.status,
        }
      : {
          date: target.date,
          route: '',
          area: 'Sintra',
          transport: 'train+bus',
          distanceKm: '',
          climbM: '',
          packKg: numberText(packPrefill(plan, data, target.date)),
          link: '',
          note: '',
          status: defaultStatus(target.date, today),
        },
  );
  const [form, setForm] = useState<Form>(base);
  const [tried, setTried] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(base);
  const result = validate(form);
  const errors: Errors = tried && !result.ok ? result.errors : {};

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  // A new trip follows its date: the planned pack and planned / done, unless I changed them.
  const setDate = (date: string) =>
    setForm((f) => {
      if (editing || !isValidISO(date)) return { ...f, date };
      const oldPack = numberText(packPrefill(plan, data, f.date));
      const newPack = numberText(packPrefill(plan, data, date));
      return {
        ...f,
        date,
        packKg: f.packKg === oldPack ? newPack : f.packKg,
        status: f.status === defaultStatus(f.date, today) ? defaultStatus(date, today) : f.status,
      };
    });

  const save = () => {
    setTried(true);
    if (!result.ok) return;
    const trip: Trip = { id: editing?.id ?? newId(), savedAt: editing?.savedAt ?? new Date().toISOString(), ...result.fields };
    const store = getStore();
    const next: AppData = upsertTrip(store.getState().data, trip);
    onClose(store.save(next) ? 'Trip saved.' : undefined);
  };

  const remove = () => {
    if (!editing) return;
    const store = getStore();
    store.save(deleteTrip(store.getState().data, editing.id));
    onClose('Trip deleted.');
  };

  const err = (k: keyof Form) => errors[k] && <span className="field-error">{errors[k]}</span>;

  return (
    <LogFrame
      title={editing ? 'Edit trip' : 'Add a trip'}
      date={isValidISO(form.date) ? form.date : base.date}
      dirty={dirty}
      canDelete={!!editing}
      onSave={save}
      onDiscard={() => onClose()}
      onDelete={remove}
      words={WORDS}
    >
      <div className="box">
        <div className="box-row field-block">
          <label className="field">
            <span className="field-label">Date</span>
            <input
              className="input input--grow"
              type="date"
              value={form.date}
              disabled={target.fixedDate}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
          {err('date')}
        </div>
        <div className="box-row field-block">
          <label className="field">
            <span className="field-label">Route</span>
            <input
              className="input input--grow"
              value={form.route}
              placeholder="Sintra – Capuchos – Peninha"
              maxLength={140}
              onChange={(e) => set('route', e.target.value)}
            />
          </label>
          {err('route')}
        </div>
        <label className="box-row field">
          <span className="field-label">Area</span>
          <select className="input input--grow" value={form.area} onChange={(e) => set('area', e.target.value as Trip['area'])}>
            {AREAS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <div className="box-row field field--stacked">
          <span className="field-label">Transport</span>
          <Segmented
            label="Transport"
            options={[
              { value: 'train+bus', label: 'Train and bus' },
              { value: 'car', label: 'Car' },
            ]}
            value={form.transport}
            onChange={(v) => v && set('transport', v)}
          />
        </div>
      </div>

      <div className="box">
        {(
          [
            ['distanceKm', 'Distance', 'km', 'decimal'],
            ['climbM', 'Climb', 'm', 'numeric'],
            ['packKg', 'Pack', 'kg', 'decimal'],
          ] as const
        ).map(([k, label, unit, mode]) => (
          <div className="box-row field-block" key={k}>
            <label className="field">
              <span className="field-label">{label}</span>
              <input
                className="input input--num"
                inputMode={mode}
                value={form[k]}
                aria-invalid={errors[k] ? true : undefined}
                onChange={(e) => set(k, e.target.value)}
              />
              <span className="text-muted text-small">{unit}</span>
            </label>
            {err(k)}
          </div>
        ))}
        <div className="box-row field-block">
          <label className="field">
            <span className="field-label">Link</span>
            <input
              className="input input--grow"
              type="url"
              inputMode="url"
              autoCapitalize="off"
              autoCorrect="off"
              placeholder="Komoot or Wikiloc"
              value={form.link}
              onChange={(e) => set('link', e.target.value)}
            />
          </label>
          {err('link')}
        </div>
        <label className="box-row field field--stacked">
          <span className="field-label">Note</span>
          <textarea className="input textarea" rows={2} value={form.note} onChange={(e) => set('note', e.target.value)} />
        </label>
        <div className="box-row field">
          <span className="field-label">Status</span>
          <Segmented
            label="Status"
            options={[
              { value: 'planned', label: 'Planned' },
              { value: 'done', label: 'Done' },
            ]}
            value={form.status}
            onChange={(v) => v && set('status', v)}
          />
        </div>
      </div>
    </LogFrame>
  );
}
