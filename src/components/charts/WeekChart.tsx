// A small chart across plan weeks 1–12: bars or lines, an optional planned band.
// Hand-made SVG; colours are Primer tokens (data-pine / data-purple pass the palette checks
// against the dark canvas). Tap a week to show it in the Week tab.
import { TOTAL_WEEKS } from '../../plan';
import { niceMax } from '../../progress';

export interface Series {
  name: string;
  values: (number | null)[];
  /** A Primer data colour variable, e.g. 'var(--data-pine-color-emphasis)'. */
  color: string;
}

const W = 358;
const H = 140;
const PAD = { top: 10, right: 12, bottom: 22, left: 48 };
const LABEL_ROOM = 58; // right margin for direct end labels on line charts


function tick(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function WeekChart({
  kind,
  series,
  band,
  unit,
  selected,
  onSelect,
  label,
}: {
  kind: 'bar' | 'line';
  series: Series[];
  /** Planned range per week, drawn as a muted band behind the data. */
  band?: ([number, number] | null)[];
  unit: string;
  selected: number;
  onSelect: (week: number) => void;
  /** Accessible name, e.g. "Hours per week". */
  label: string;
}) {
  const right = PAD.right + (kind === 'line' && series.length > 1 ? LABEL_ROOM : 0);
  const plotW = W - PAD.left - right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / TOTAL_WEEKS;
  const cx = (i: number) => PAD.left + slot * (i + 0.5);

  const all = [
    ...series.flatMap((s) => s.values.filter((v): v is number => v !== null)),
    ...(band ?? []).flatMap((b) => (b ? [b[1]] : [])),
  ];
  const top = niceMax(Math.max(0, ...all) * 1.05);
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const grid = [top / 2, top];

  // End labels for multi-series lines; dropped when they'd collide (the legend still names them).
  const ends = series.map((s) => {
    for (let i = s.values.length - 1; i >= 0; i--) if (s.values[i] !== null) return { i, v: s.values[i]! };
    return null;
  });
  const endYs = ends.map((e) => (e ? y(e.v) : null)).filter((v): v is number => v !== null);
  const labelsFit =
    kind === 'line' && series.length > 1 && endYs.every((a, i) => endYs.every((b, j) => i === j || Math.abs(a - b) >= 14));

  const barW = Math.min(24, slot * 0.62);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      {/* grid: two hairlines and the baseline */}
      {grid.map((g) => (
        <g key={g}>
          <line className="chart-grid" x1={PAD.left} x2={W - right} y1={y(g)} y2={y(g)} />
          <text className="chart-tick" x={PAD.left - 6} y={y(g)} dy="0.35em" textAnchor="end">
            {g === top ? `${tick(g)} ${unit}` : tick(g)}
          </text>
        </g>
      ))}
      <line className="chart-axis" x1={PAD.left} x2={W - right} y1={y(0)} y2={y(0)} />
      <text className="chart-tick" x={PAD.left - 6} y={y(0)} dy="0.35em" textAnchor="end">
        0
      </text>

      {/* planned band */}
      {band?.map((b, i) =>
        b ? (
          <rect
            key={`b${i}`}
            className="chart-band"
            x={cx(i) - slot / 2 + 1}
            width={slot - 2}
            y={y(b[1]) - (b[0] === b[1] ? 1.5 : 0)}
            height={Math.max(3, y(b[0]) - y(b[1]))}
            rx={1.5}
          />
        ) : null,
      )}

      {/* data */}
      {kind === 'bar' &&
        series[0].values.map((v, i) => {
          if (!v) return null;
          const h = y(0) - y(v);
          const r = Math.min(4, h, barW / 2);
          const x0 = cx(i) - barW / 2;
          const yTop = y(v);
          return (
            <path
              key={i}
              className={i + 1 === selected ? 'chart-bar chart-bar--on' : 'chart-bar'}
              style={{ fill: series[0].color }}
              // rounded top, square at the baseline
              d={`M${x0},${y(0)} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x0 + barW - r} Q${x0 + barW},${yTop} ${x0 + barW},${yTop + r} V${y(0)} Z`}
            />
          );
        })}
      {kind === 'line' &&
        series.map((s) => {
          // break the line where a week has no value
          const runs: { i: number; v: number }[][] = [];
          let run: { i: number; v: number }[] = [];
          s.values.forEach((v, i) => {
            if (v === null) {
              if (run.length) runs.push(run);
              run = [];
            } else run.push({ i, v });
          });
          if (run.length) runs.push(run);
          return (
            <g key={s.name}>
              {runs.map((r, k) =>
                r.length > 1 ? (
                  <polyline
                    key={k}
                    className="chart-line"
                    style={{ stroke: s.color }}
                    points={r.map((p) => `${cx(p.i)},${y(p.v)}`).join(' ')}
                  />
                ) : null,
              )}
              {s.values.map((v, i) =>
                v === null ? null : (
                  <circle
                    key={i}
                    className={i + 1 === selected ? 'chart-dot chart-dot--on' : 'chart-dot'}
                    style={{ fill: s.color }}
                    cx={cx(i)}
                    cy={y(v)}
                    r={i + 1 === selected ? 5 : 4}
                  />
                ),
              )}
            </g>
          );
        })}

      {labelsFit &&
        series.map((s, k) => {
          const e = ends[k];
          if (!e) return null;
          return (
            <text key={s.name} className="chart-label" x={cx(e.i) + 9} y={y(e.v)} dy="0.35em">
              {s.name}
            </text>
          );
        })}

      {/* week numbers and tap targets */}
      {Array.from({ length: TOTAL_WEEKS }, (_, i) => (
        <g key={`w${i}`}>
          <text
            className={i + 1 === selected ? 'chart-week chart-week--on' : 'chart-week'}
            x={cx(i)}
            y={H - 6}
            textAnchor="middle"
          >
            {i + 1}
          </text>
          <rect
            className="chart-hit"
            x={cx(i) - slot / 2}
            y={0}
            width={slot}
            height={H}
            onClick={() => onSelect(i + 1)}
          >
            <title>
              {`Week ${i + 1}: ${series.map((s) => `${series.length > 1 ? `${s.name} ` : ''}${s.values[i] ?? 'no log'}${s.values[i] !== null ? ` ${unit}` : ''}`).join(', ')}`}
            </title>
          </rect>
        </g>
      ))}
    </svg>
  );
}
