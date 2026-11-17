import { useEffect, useRef, useState } from 'react';
import { AlertIcon, ChevronLeftIcon, ChevronRightIcon } from '@primer/octicons-react';
import { MAX_WEEKS, SESSION_KINDS, type Day, type Exercise, type Plan, type SessionKind, type SessionType } from '../schema';
import { DAY_NAMES, DAY_ORDER, isValidISO, longDate, shortDate, weekdayOf } from '../dates';
import { useAppData } from '../store';
import { editCycle, removeCycle, switchCycle } from '../actions';
import {
  addSession,
  addSwap,
  blocksOf,
  dayText,
  deleteSwap,
  KIND_HELP,
  KIND_TEXT,
  mondayOnOrAfter,
  planProblems,
  sessionSummary,
  setPatternDay,
  setWeekCount,
  updateRules,
  updateSwap,
} from '../cycles';
import { Dialog } from '../components/Dialog';
import { DayDialog } from '../components/cycle/DayDialog';
import { ExerciseDialog } from '../components/cycle/ExerciseDialog';
import { SessionPage } from '../components/cycle/SessionPage';
import { WeekPage } from '../components/cycle/WeekPage';
import { Check, Stepper, TextField } from '../components/cycle/fields';

type Page = { kind: 'main' } | { kind: 'session'; id: SessionType } | { kind: 'week'; week: number };
type Edit = (change: (plan: Plan) => Plan) => void;

function AddSessionDialog({ plan, edit, onAdded, onClose }: { plan: Plan; edit: Edit; onAdded: (id: SessionType) => void; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<SessionKind>('strength');
  const [error, setError] = useState('');
  const add = () => {
    if (!title.trim()) return setError('Give the session a title.');
    const { id } = addSession(plan, title, kind);
    edit((p) => addSession(p, title, kind).plan);
    onAdded(id);
  };
  return (
    <Dialog
      title="Add session"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={add}>
            Add
          </button>
        </>
      }
    >
      <label className="box-row field">
        <span className="field-label">Title</span>
        <input
          className="input input--grow"
          value={title}
          maxLength={60}
          placeholder="Strength C"
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>
      <div className="box-row field field--stacked" role="radiogroup" aria-label="Kind">
        <span className="field-label">Kind</span>
        {SESSION_KINDS.filter((k) => k !== 'rest').map((k) => (
          <label key={k} className="radio-option">
            <input type="radio" className="checkbox" name="session-kind" checked={kind === k} onChange={() => setKind(k)} />
            <span className="option-day">
              <span className="option-name">{KIND_TEXT[k]}</span>
              <span className="text-muted text-small">{KIND_HELP[k]}</span>
            </span>
          </label>
        ))}
      </div>
      {error && <p className="box-row field-error">{error}</p>}
    </Dialog>
  );
}

function StartField({ plan, edit }: { plan: Plan; edit: Edit }) {
  const [draft, setDraft] = useState(plan.startDate);
  useEffect(() => setDraft(plan.startDate), [plan.startDate]);
  const valid = isValidISO(draft);
  const monday = valid && weekdayOf(draft) === 'mon';
  return (
    <>
      <label className="box-row field">
        <span className="field-label">Starts</span>
        <input
          className="input input--grow"
          type="date"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (isValidISO(e.target.value) && weekdayOf(e.target.value) === 'mon') {
              const startDate = e.target.value;
              edit((p) => ({ ...p, startDate }));
            }
          }}
        />
      </label>
      {valid && !monday && (
        <div className="box-row field-hint">
          <span>The cycle starts on a Monday.</span>
          <button
            className="btn"
            onClick={() => {
              const startDate = mondayOnOrAfter(draft);
              edit((p) => ({ ...p, startDate }));
            }}
          >
            Use {shortDate(mondayOnOrAfter(draft))}
          </button>
        </div>
      )}
    </>
  );
}

function RulesBox({ plan, edit }: { plan: Plan; edit: Edit }) {
  const rules = plan.rules ?? {};
  const blocks = blocksOf(plan);
  const setMain = (block: number, sets: string, reps: string) => {
    const mainLifts = { ...(rules.mainLifts ?? {}) };
    const n = Number(sets);
    if (Number.isInteger(n) && n >= 1 && n <= 12 && reps.trim()) mainLifts[String(block)] = { sets: n, reps: reps.trim() };
    else delete mainLifts[String(block)];
    edit((p) => updateRules(p, { mainLifts }));
  };
  const setHint = (block: number, text: string) => {
    const blockHints = { ...(rules.blockHints ?? {}) };
    if (text) blockHints[String(block)] = text;
    else delete blockHints[String(block)];
    edit((p) => updateRules(p, { blockHints }));
  };

  return (
    <article className="box">
      <header className="box-header">
        <h2 className="box-title">Rules</h2>
      </header>
      <Check
        label="Lighter weeks: cut gym sets and minutes by a third"
        hint="Strength sets × 2/3 and cardio minutes × 2/3 in weeks marked Lighter."
        checked={!!rules.lighterCut}
        onChange={(lighterCut) => edit((p) => updateRules(p, { lighterCut }))}
      />
      <Check
        label="Test weeks: halve Monday to Thursday"
        hint="Strength sets and cardio minutes halved Monday to Thursday in weeks marked Test."
        checked={!!rules.testWeekHalve}
        onChange={(testWeekHalve) => edit((p) => updateRules(p, { testWeekHalve }))}
      />
      {blocks.map((b) => (
        <BlockRule
          key={b}
          block={b}
          main={rules.mainLifts?.[String(b)]}
          hint={rules.blockHints?.[String(b)] ?? ''}
          onMain={(sets, reps) => setMain(b, sets, reps)}
          onHint={(text) => setHint(b, text)}
        />
      ))}
    </article>
  );
}

function BlockRule({
  block,
  main,
  hint,
  onMain,
  onHint,
}: {
  block: number;
  main?: { sets: number; reps: string };
  hint: string;
  onMain: (sets: string, reps: string) => void;
  onHint: (text: string) => void;
}) {
  const [sets, setSets] = useState(main ? String(main.sets) : '');
  const [reps, setReps] = useState(main?.reps ?? '');
  useEffect(() => {
    setSets(main ? String(main.sets) : '');
    setReps(main?.reps ?? '');
  }, [main]);
  const commit = () => {
    if (sets === (main ? String(main.sets) : '') && reps === (main?.reps ?? '')) return;
    onMain(sets, reps);
  };
  return (
    <div className="block-rule">
      <p className="box-row box-row--note">
        <strong className="block-rule-title">Block {block}</strong>
      </p>
      <div className="box-row field">
        <span className="field-label">Main lifts</span>
        <input
          className="input input--num"
          inputMode="numeric"
          aria-label={`Block ${block} main lift sets`}
          placeholder="–"
          value={sets}
          onChange={(e) => setSets(e.target.value)}
          onBlur={commit}
        />
        <span className="text-muted">×</span>
        <input
          className="input input--num"
          aria-label={`Block ${block} main lift reps`}
          placeholder="–"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          onBlur={commit}
        />
        <span className="text-muted text-small">{main ? '' : 'as written'}</span>
      </div>
      <TextField label="Hint" value={hint} placeholder="Shown under strength sessions" onCommit={onHint} />
    </div>
  );
}

function SwapsBox({ plan, edit }: { plan: Plan; edit: Edit }) {
  const [open, setOpen] = useState<Exercise | 'new' | null>(null);
  return (
    <article className="box">
      <header className="box-header">
        <h2 className="box-title">Swap library</h2>
        <button className="btn-invisible" onClick={() => setOpen('new')}>
          Add swap
        </button>
      </header>
      {plan.exerciseLibrary.length === 0 ? (
        <p className="box-row box-row--note">Alternatives an exercise can offer on the day, e.g. lat pulldown for pull-ups. Pick them in the exercise.</p>
      ) : (
        <ul>
          {plan.exerciseLibrary.map((ex) => (
            <li key={ex.id}>
              <button className="box-row exercise exercise--button" onClick={() => setOpen(ex)}>
                <div>
                  <div className="exercise-name">{ex.name}</div>
                  {ex.mainLift && <div className="text-muted text-small">Main lift</div>}
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
      {open && (
        <ExerciseDialog
          exercise={open === 'new' ? null : open}
          library={[]}
          isSwap
          onSave={(fields) => {
            edit((p) => (open === 'new' ? addSwap(p, fields) : updateSwap(p, open.id, fields)));
            setOpen(null);
          }}
          onDelete={
            open !== 'new'
              ? () => {
                  edit((p) => deleteSwap(p, open.id));
                  setOpen(null);
                }
              : undefined
          }
          onClose={() => setOpen(null)}
        />
      )}
    </article>
  );
}

/** The plan editor for one training cycle (full screen). Every change saves straight away. */
export function CycleEditor({
  id,
  today,
  onClose,
}: {
  id: string;
  builtIn: Plan;
  today: string;
  onClose: (saved?: string) => void;
}) {
  const { cycles, activeCycle } = useAppData();
  const cycle = cycles.find((c) => c.id === id);
  const [page, setPage] = useState<Page>({ kind: 'main' });
  const [picking, setPicking] = useState<Day | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<'use' | 'delete' | 'weeks' | null>(null);
  const [pendingWeeks, setPendingWeeks] = useState(0);
  const pageRef = useRef(page);
  pageRef.current = page;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Android back: a sub-page goes back to the cycle, the cycle goes back to More.
  useEffect(() => {
    window.history.pushState({ mtaCycle: true }, '');
    const popped = { current: false };
    const onPop = () => {
      if (pageRef.current.kind !== 'main') {
        setPage({ kind: 'main' });
        window.history.pushState({ mtaCycle: true }, '');
      } else {
        popped.current = true;
        closeRef.current();
      }
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (!popped.current) window.history.back();
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page]);

  if (!cycle) {
    return (
      <section className="blankslate">
        <h1 className="page-title">This cycle was deleted</h1>
        <p>
          <button className="btn" onClick={() => onClose()}>
            Back to More
          </button>
        </p>
      </section>
    );
  }

  const plan = cycle.plan;
  const edit: Edit = (change) => editCycle(id, change);
  const problems = planProblems(plan);
  const inUse = activeCycle === id;

  if (page.kind === 'session') {
    return <SessionPage plan={plan} id={page.id} cycleName={cycle.name} edit={edit} onBack={() => setPage({ kind: 'main' })} />;
  }
  if (page.kind === 'week') {
    return (
      <WeekPage
        plan={plan}
        week={page.week}
        cycleName={cycle.name}
        edit={edit}
        onBack={() => setPage({ kind: 'main' })}
        onWeek={(week) => setPage({ kind: 'week', week })}
      />
    );
  }

  const changeWeeks = (n: number) => {
    // Taking weeks off asks first; adding is safe.
    if (n < plan.weeks.length) {
      setPendingWeeks(n);
      setConfirm('weeks');
    } else edit((p) => setWeekCount(p, n));
  };
  const templates = Object.values(plan.templates);

  return (
    <section>
      <header className="log-head">
        <button className="btn-invisible back" onClick={() => onClose()}>
          <ChevronLeftIcon /> More
        </button>
        <h1 className="page-title">{cycle.name}</h1>
        <div className="meta-row">
          {inUse ? <span className="label label--accent">In use</span> : <span className="label">Not in use</span>}
          <span className="text-muted">
            {plan.weeks.length} {plan.weeks.length === 1 ? 'week' : 'weeks'}
            {isValidISO(plan.startDate) ? ` from ${longDate(plan.startDate)}` : ''}
          </span>
        </div>
      </header>

      <div className="stack">
        {problems.length > 0 && (
          <article className="box box--attention" role="status">
            <header className="box-header">
              <h2 className="box-title">
                <AlertIcon className="text-attention" /> Fix before using
              </h2>
            </header>
            <ul>
              {problems.map((p) => (
                <li key={p} className="box-row">
                  {p}
                </li>
              ))}
            </ul>
          </article>
        )}
        {inUse && (
          <p className="text-muted text-small">This cycle is in use: changes show on Today and Week straight away.</p>
        )}

        <article className="box">
          <header className="box-header">
            <h2 className="box-title">Basics</h2>
          </header>
          <TextField label="Name" value={cycle.name} required maxLength={40} onCommit={(name) => edit((p) => ({ ...p, name }))} />
          <StartField plan={plan} edit={edit} />
          <Stepper
            label="Weeks"
            value={plan.weeks.length}
            min={1}
            max={MAX_WEEKS}
            onChange={changeWeeks}
          />
          <TextField
            label="Every session"
            stacked
            value={plan.reminders.everySession}
            placeholder="e.g. 10 min warm-up"
            onCommit={(everySession) => edit((p) => ({ ...p, reminders: { ...p.reminders, everySession } }))}
          />
          <TextField
            label="Every day"
            stacked
            value={plan.reminders.everyDay}
            placeholder="e.g. 10 min mobility"
            onCommit={(everyDay) => edit((p) => ({ ...p, reminders: { ...p.reminders, everyDay } }))}
          />
        </article>

        <article className="box">
          <header className="box-header">
            <h2 className="box-title">Sessions</h2>
            <button className="btn-invisible" onClick={() => setAdding(true)}>
              Add session
            </button>
          </header>
          <ul>
            {templates.map((t) => (
              <li key={t.type}>
                <button className="box-row option-row" onClick={() => setPage({ kind: 'session', id: t.type })}>
                  <span className="option-day">
                    <span className="option-name">{t.title}</span>
                    <span className="text-muted text-small">
                      {KIND_TEXT[t.kind]} · {sessionSummary(t)}
                    </span>
                  </span>
                  <ChevronRightIcon className="text-muted" />
                </button>
              </li>
            ))}
          </ul>
        </article>

        <article className="box">
          <header className="box-header">
            <h2 className="box-title">Week pattern</h2>
          </header>
          <p className="box-row box-row--note">The sessions on each day of a normal week. Change single weeks under Weeks.</p>
          <ul>
            {DAY_ORDER.map((d) =>
              d === 'fri' ? (
                <li key={d} className="box-row day-row text-muted">
                  <span className="day-row-when">
                    <span className="day-row-day">{DAY_NAMES[d].slice(0, 3)}</span>
                  </span>
                  <span className="day-row-what">Rest, always</span>
                </li>
              ) : (
                <li key={d}>
                  <button className="box-row day-row" onClick={() => setPicking(d)}>
                    <span className="day-row-when">
                      <span className="day-row-day">{DAY_NAMES[d].slice(0, 3)}</span>
                    </span>
                    <span className="day-row-what">{dayText(plan, plan.weekly[d])}</span>
                    <ChevronRightIcon className="text-muted" />
                  </button>
                </li>
              ),
            )}
          </ul>
        </article>

        <article className="box">
          <header className="box-header">
            <h2 className="box-title">Weeks</h2>
            <span className="box-meta">{plan.weeks.length}</span>
          </header>
          <ul>
            {plan.weeks.map((w) => {
              const changed = Object.keys(w.dayChanges ?? {}).length;
              const bits = [
                w.longHike.hours && `hike ${w.longHike.hours}${w.longHike.packKg ? `, ${w.longHike.packKg}` : ''}`,
                changed ? `${changed} ${changed === 1 ? 'day' : 'days'} changed` : '',
              ].filter(Boolean);
              return (
                <li key={w.week}>
                  <button className="box-row option-row" onClick={() => setPage({ kind: 'week', week: w.week })}>
                    <span className="option-day">
                      <span className="option-name">Week {w.week}</span>
                      <span className="text-muted text-small">
                        Block {w.block}
                        {bits.length ? ` · ${bits.join(' · ')}` : ''}
                      </span>
                    </span>
                    {w.kind !== 'build' && (
                      <span className="label label--attention">{w.kind === 'lighter' ? 'Lighter' : 'Test'}</span>
                    )}
                    <ChevronRightIcon className="text-muted" />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="box-row button-row">
            <button className="btn" disabled={plan.weeks.length >= MAX_WEEKS} onClick={() => changeWeeks(plan.weeks.length + 1)}>
              Add a week
            </button>
          </div>
        </article>

        <RulesBox plan={plan} edit={edit} />
        <SwapsBox plan={plan} edit={edit} />

        <div className="cycle-actions">
          {!inUse && (
            <button className="btn btn-primary btn-block" disabled={problems.length > 0} onClick={() => setConfirm('use')}>
              Use this cycle
            </button>
          )}
          {!inUse && problems.length > 0 && <p className="text-muted text-small">Fix the problems above to use it.</p>}
          <button className="btn btn-danger" onClick={() => setConfirm('delete')}>
            Delete cycle
          </button>
        </div>
      </div>

      {picking && (
        <DayDialog
          plan={plan}
          title={`${DAY_NAMES[picking]}, every week`}
          initial={plan.weekly[picking]}
          onSave={(list) => {
            edit((p) => setPatternDay(p, picking, list));
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
      {adding && (
        <AddSessionDialog
          plan={plan}
          edit={edit}
          onClose={() => setAdding(false)}
          onAdded={(sid) => {
            setAdding(false);
            setPage({ kind: 'session', id: sid });
          }}
        />
      )}
      {confirm === 'weeks' && (
        <Dialog
          title={`Keep ${pendingWeeks} ${pendingWeeks === 1 ? 'week' : 'weeks'}?`}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  edit((p) => setWeekCount(p, pendingWeeks));
                  setConfirm(null);
                }}
              >
                Remove week {plan.weeks.length}
              </button>
            </>
          }
        >
          <p className="box-row text-muted">The last week and its targets are removed from the cycle. Logs stay.</p>
        </Dialog>
      )}
      {confirm === 'use' && (
        <Dialog
          title={`Use ${cycle.name}?`}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setConfirm(null);
                  if (switchCycle(id)) onClose(`Using ${cycle.name}.`);
                }}
              >
                Use it
              </button>
            </>
          }
        >
          <p className="box-row text-muted">
            Today and Week follow this cycle, starting {longDate(plan.startDate)}
            {plan.startDate > today ? '. Until then, Today shows when it starts' : ''}. Your logs, tests and trips
            stay, and you can switch back to the 12-week plan in More.
          </p>
        </Dialog>
      )}
      {confirm === 'delete' && (
        <Dialog
          title={`Delete ${cycle.name}?`}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <button className="btn" onClick={() => setConfirm(null)}>
                Keep it
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  const name = cycle.name;
                  setConfirm(null);
                  if (removeCycle(id)) onClose(`${name} deleted.`);
                }}
              >
                Delete
              </button>
            </>
          }
        >
          <p className="box-row text-muted">
            The cycle and the plan changes made in it go.{inUse ? ' The 12-week plan is used again.' : ''} Your logs stay.
          </p>
        </Dialog>
      )}
    </section>
  );
}
