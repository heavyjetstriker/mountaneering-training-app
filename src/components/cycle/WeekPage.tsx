import { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@primer/octicons-react';
import { MAX_WEEKS, type Day, type Plan, type PlanWeek } from '../../schema';
import { DAY_NAMES, DAY_ORDER } from '../../dates';
import { weekTargetNames } from '../../plan';
import { dayText, setWeekDay, updateWeek } from '../../cycles';
import { Segmented } from '../Segmented';
import { DayDialog } from './DayDialog';
import { Stepper, TextField } from './fields';

/** One week of a cycle: block, kind, the week's targets, notes and its own days. */
export function WeekPage({
  plan,
  week,
  cycleName,
  edit,
  onBack,
  onWeek,
}: {
  plan: Plan;
  week: number;
  cycleName: string;
  edit: (change: (plan: Plan) => Plan) => void;
  onBack: () => void;
  onWeek: (w: number) => void;
}) {
  const [picking, setPicking] = useState<Day | null>(null);
  const w = plan.weeks.find((x) => x.week === week);
  if (!w) return null;
  const names = weekTargetNames(plan);
  const hasIntervals = Object.values(plan.templates).some((t) => t.intervals);
  const set = (patch: Partial<Omit<PlanWeek, 'week'>>) => edit((p) => updateWeek(p, week, patch));

  return (
    <section>
      <header className="log-head">
        <button className="btn-invisible back" onClick={onBack}>
          <ChevronLeftIcon /> {cycleName}
        </button>
        <div className="week-nav">
          <button className="btn btn-icon" aria-label="Previous week" disabled={week === 1} onClick={() => onWeek(week - 1)}>
            <ChevronLeftIcon />
          </button>
          <h1 className="page-title">Week {week}</h1>
          <button
            className="btn btn-icon"
            aria-label="Next week"
            disabled={week === plan.weeks.length}
            onClick={() => onWeek(week + 1)}
          >
            <ChevronRightIcon />
          </button>
        </div>
      </header>
      <div className="stack" key={week}>
        <article className="box">
          <header className="box-header">
            <h2 className="box-title">Week</h2>
          </header>
          <Stepper label="Block" value={w.block} min={1} max={MAX_WEEKS} onChange={(block) => set({ block })} />
          <div className="box-row field field--stacked">
            <span className="field-label">Kind</span>
            <Segmented
              label="Kind of week"
              options={[
                { value: 'build', label: 'Build' },
                { value: 'lighter', label: 'Lighter' },
                { value: 'test', label: 'Test' },
              ]}
              value={w.kind}
              onChange={(kind) => kind && set({ kind })}
            />
          </div>
          {w.kind !== 'build' && (
            <p className="box-row box-row--note">
              {w.kind === 'lighter'
                ? plan.rules?.lighterCut
                  ? 'Gym sets and minutes are cut by a third (Rules).'
                  : 'Shown as a lighter week. Switch on the cut in Rules to cut gym sets and minutes.'
                : plan.rules?.testWeekHalve
                  ? 'Monday to Thursday gym volume is halved (Rules).'
                  : 'Shown as a test week. Switch on halving in Rules to halve Monday to Thursday.'}
            </p>
          )}
          {hasIntervals && (
            <Stepper
              label="Intervals"
              value={w.intervals ?? 0}
              min={0}
              max={12}
              onChange={(n) => set({ intervals: n || undefined })}
              unit={(n) => (n ? `${n} × 4 min` : 'None')}
            />
          )}
          <TextField label="Notes" multiline value={w.notes} onCommit={(notes) => set({ notes })} />
        </article>

        {(names.hike || names.recovery || names.endurance) && (
          <article className="box">
            <header className="box-header">
              <h2 className="box-title">Targets</h2>
            </header>
            {names.hike && (
              <>
                <TextField
                  label="Hike length"
                  value={w.longHike.hours}
                  placeholder="3 h"
                  onCommit={(hours) => set({ longHike: { ...w.longHike, hours } })}
                />
                <TextField
                  label="Hike pack"
                  value={w.longHike.packKg}
                  placeholder="8 kg"
                  onCommit={(packKg) => set({ longHike: { ...w.longHike, packKg } })}
                />
              </>
            )}
            {names.recovery && <TextField label={names.recovery} stacked value={w.sunday} onCommit={(sunday) => set({ sunday })} />}
            {names.endurance && (
              <TextField label={names.endurance} multiline value={w.meVolume} onCommit={(meVolume) => set({ meVolume })} />
            )}
          </article>
        )}

        <article className="box">
          <header className="box-header">
            <h2 className="box-title">Days this week</h2>
          </header>
          <p className="box-row box-row--note">Days follow the weekly pattern unless you change them for this week.</p>
          <ul>
            {DAY_ORDER.map((d) => {
              const own = w.dayChanges?.[d];
              const text = dayText(plan, own ?? plan.weekly[d]);
              if (d === 'fri') {
                return (
                  <li key={d} className="box-row day-row text-muted">
                    <span className="day-row-when">
                      <span className="day-row-day">{DAY_NAMES[d].slice(0, 3)}</span>
                    </span>
                    <span className="day-row-what">Rest, always</span>
                  </li>
                );
              }
              return (
                <li key={d}>
                  <button className="box-row day-row" onClick={() => setPicking(d)}>
                    <span className="day-row-when">
                      <span className="day-row-day">{DAY_NAMES[d].slice(0, 3)}</span>
                    </span>
                    <span className="day-row-what">{text}</span>
                    {own && <span className="label label--attention">This week</span>}
                    <ChevronRightIcon className="text-muted" />
                  </button>
                </li>
              );
            })}
          </ul>
        </article>
      </div>
      {picking && (
        <DayDialog
          plan={plan}
          title={`Week ${week}, ${DAY_NAMES[picking]}`}
          initial={w.dayChanges?.[picking] ?? plan.weekly[picking]}
          onSave={(list) => {
            edit((p) => setWeekDay(p, week, picking, list));
            setPicking(null);
          }}
          onUsePattern={
            w.dayChanges?.[picking]
              ? () => {
                  edit((p) => setWeekDay(p, week, picking, null));
                  setPicking(null);
                }
              : undefined
          }
          onClose={() => setPicking(null)}
        />
      )}
    </section>
  );
}
