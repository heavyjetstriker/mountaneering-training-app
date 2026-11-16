import { useMemo } from 'react';
import type { Plan } from '../../schema';
import { useAppData } from '../../store';
import { hoursByWeek, packByWeek, topSetByWeek } from '../../progress';
import { WeekChart, type Series } from './WeekChart';

const PINE = 'var(--data-pine-color-emphasis)';
const PURPLE = 'var(--data-purple-color-emphasis)';

const kg = (n: number | null) => (n === null ? 'no log' : `${n} kg`);

/** The numbers again as a table, for screen readers. */
function HiddenTable({ caption, cols, rows }: { caption: string; cols: string[]; rows: (string | number)[][] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {cols.map((c) => (
            <th key={c} scope="col">
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={String(r[0])}>
            {r.map((c, i) => (i === 0 ? <th key={i} scope="row">{c}</th> : <td key={i}>{c}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChartBox({ title, meta, empty, children }: { title: string; meta: string; empty: boolean; children: React.ReactNode }) {
  return (
    <article className="box">
      <header className="box-header">
        <h3 className="box-title">{title}</h3>
      </header>
      {empty ? (
        <p className="box-row text-muted">Log a few sessions to see this.</p>
      ) : (
        <>
          <p className="box-row chart-meta">{meta}</p>
          {children}
        </>
      )}
    </article>
  );
}

/** Week tab → Progress: hours, long-hike pack, squat and deadlift, across weeks 1–12. */
export function ProgressCharts({ plan, week, onSelect }: { plan: Plan; week: number; onSelect: (w: number) => void }) {
  const { logs } = useAppData();
  const hours = useMemo(() => hoursByWeek(plan, logs), [plan, logs]);
  const pack = useMemo(() => packByWeek(plan, logs), [plan, logs]);
  const squat = useMemo(() => topSetByWeek(plan, logs, 'back-squat'), [plan, logs]);
  const dead = useMemo(() => topSetByWeek(plan, logs, 'deadlift'), [plan, logs]);
  const i = week - 1;
  const weeks = hours.map((_, k) => `Week ${k + 1}`);

  const p = pack[i];
  const planned = p.planned ? (p.planned[0] === p.planned[1] ? `${p.planned[0]} kg` : `${p.planned[0]}–${p.planned[1]} kg`) : '';
  const lifts: Series[] = [
    { name: 'Squat', values: squat, color: PINE },
    { name: 'Deadlift', values: dead, color: PURPLE },
  ];

  return (
    <section className="stack" aria-labelledby="progress-title">
      <h2 className="section-title" id="progress-title">
        Progress
      </h2>

      <ChartBox title="Hours per week" meta={`Week ${week}: ${hours[i] ? `${hours[i]} h` : 'no log'}`} empty={hours.every((h) => !h)}>
        <div className="box-row chart-row">
          <WeekChart
            kind="bar"
            label="Hours trained per week"
            unit="h"
            series={[{ name: 'Hours', values: hours.map((h) => h || null), color: PINE }]}
            selected={week}
            onSelect={onSelect}
          />
        </div>
        <HiddenTable caption="Hours trained per week" cols={['Week', 'Hours']} rows={hours.map((h, k) => [weeks[k], h])} />
      </ChartBox>

      <ChartBox
        title="Long-hike pack"
        meta={`Week ${week}: ${kg(p.logged)}${planned ? ` (planned ${planned})` : ''}`}
        empty={pack.every((w) => w.logged === null)}
      >
        <div className="box-row chart-legend" aria-hidden="true">
          <span className="chart-key" style={{ ['--key' as string]: PINE }}>
            Logged
          </span>
          <span className="chart-key chart-key--band">Planned</span>
        </div>
        <div className="box-row chart-row">
          <WeekChart
            kind="line"
            label="Long-hike pack, logged and planned, per week"
            unit="kg"
            series={[{ name: 'Logged', values: pack.map((w) => w.logged), color: PINE }]}
            band={pack.map((w) => w.planned)}
            selected={week}
            onSelect={onSelect}
          />
        </div>
        <HiddenTable
          caption="Long-hike pack per week"
          cols={['Week', 'Logged', 'Planned']}
          rows={pack.map((w, k) => [weeks[k], kg(w.logged), w.planned ? `${w.planned[0]}–${w.planned[1]} kg` : ''])}
        />
      </ChartBox>

      <ChartBox
        title="Squat and deadlift"
        meta={`Week ${week}: squat ${kg(squat[i])}, deadlift ${kg(dead[i])}`}
        empty={squat.every((v) => v === null) && dead.every((v) => v === null)}
      >
        <div className="box-row chart-legend" aria-hidden="true">
          {lifts.map((s) => (
            <span key={s.name} className="chart-key" style={{ ['--key' as string]: s.color }}>
              {s.name}
            </span>
          ))}
          <span>Top set</span>
        </div>
        <div className="box-row chart-row">
          <WeekChart
            kind="line"
            label="Back squat and deadlift top set per week"
            unit="kg"
            series={lifts}
            selected={week}
            onSelect={onSelect}
          />
        </div>
        <HiddenTable
          caption="Top set per week"
          cols={['Week', 'Squat', 'Deadlift']}
          rows={squat.map((s, k) => [weeks[k], kg(s), kg(dead[k])])}
        />
        <p className="box-row text-muted text-small">
          The heaviest set of back squat and deadlift each week. A replaced exercise isn't included.
        </p>
      </ChartBox>
    </section>
  );
}
