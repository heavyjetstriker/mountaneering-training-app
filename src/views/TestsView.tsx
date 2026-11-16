import { ChevronRightIcon } from '@primer/octicons-react';
import type { TestType } from '../logSchema';
import { addDays, shortDate } from '../dates';
import { useAppData } from '../store';
import { useLogActions } from '../logContext';
import {
  aerobicThreshold,
  driftPassed,
  firstAerobicThreshold,
  intervalsText,
  latestOf,
  resultText,
  sortResults,
  statusAsOf,
  TEST_TITLES,
  verticalChange,
  verticalChangeText,
  verticalImproved,
  zone2Range,
} from '../tests';

const EMPTY: Record<TestType, string> = {
  drift: 'No drift test yet',
  threshold: 'No threshold test yet',
  vertical: 'No vertical test yet',
};

/** Tests tab: the intervals switch, my Zone 2 range, latest results and history. */
export function TestsView({ today }: { today: string }) {
  const { tests } = useAppData();
  const { openTestForm } = useLogActions();
  const status = statusAsOf(tests, today);
  const at = aerobicThreshold(tests, addDays(today, 1));
  const firstAt = firstAerobicThreshold(tests);
  const change = verticalChange(tests, today);
  const history = sortResults(tests).reverse();
  const edit = (id: string, date: string) => openTestForm({ types: [], date, editId: id });

  return (
    <section className="stack">
      <h1 className="page-title">Tests</h1>
      <div>
        <button className="btn btn-primary" onClick={() => openTestForm({ types: ['drift'], date: today })}>
          Add a test result
        </button>
      </div>

      <article className="box">
        <header className="box-header">
          <h2 className="box-title">Intervals</h2>
        </header>
        <div className="box-row status-row">
          <span className={`label ${status.on ? 'label--success' : ''}`}>{status.on ? 'On' : 'Off'}</span>
          <span>{intervalsText(status)}</span>
        </div>
        <p className="box-row box-row--note">
          Tuesday intervals run in weeks 5–7. If they're off, retest the drift in week 8.
        </p>
      </article>

      <article className="box">
        <header className="box-header">
          <h2 className="box-title">Zone 2</h2>
        </header>
        {at ? (
          <>
            <p className="box-row">
              <span>
                Aerobic threshold {at.hr} bpm <span className="text-muted">(drift test, {shortDate(at.date)})</span>
              </span>
            </p>
            <p className="box-row">
              Zone 2: {zone2Range(at.hr)[0]}–{zone2Range(at.hr)[1]} bpm
            </p>
            {firstAt && firstAt.date !== at.date && (
              <p className="box-row text-muted text-small">
                First: {firstAt.hr} bpm ({shortDate(firstAt.date)})
              </p>
            )}
          </>
        ) : (
          <p className="box-row text-muted">Do a drift test to set your Zone 2 range.</p>
        )}
      </article>

      <article className="box">
        <header className="box-header">
          <h2 className="box-title">Latest results</h2>
        </header>
        {(['drift', 'threshold', 'vertical'] as const).map((type) => {
          const r = latestOf(tests, type, today);
          if (!r) {
            return (
              <p className="box-row text-muted" key={type}>
                {EMPTY[type]}
              </p>
            );
          }
          return (
            <div className="box-row result-row" key={type}>
              <div>
                {resultText(r)} <span className="text-muted">· {shortDate(r.date)}</span>
              </div>
              {r.type === 'drift' && !driftPassed(r) && (
                <div className="text-attention text-small">Repeat another day a few beats lower.</div>
              )}
              {r.type === 'vertical' && change && (
                <div className={`text-small ${verticalImproved(change) ? 'text-success' : 'text-muted'}`}>
                  vs first test ({shortDate(change.first.date)}): {verticalChangeText(change)}
                </div>
              )}
            </div>
          );
        })}
      </article>

      <article className="box">
        <header className="box-header">
          <h2 className="box-title">History</h2>
          {history.length > 0 && <span className="box-meta">{history.length}</span>}
        </header>
        {history.length === 0 ? (
          <div className="blankslate blankslate--box">
            <p className="text-muted">No results yet. Your week 1 Tuesday is the drift and vertical test.</p>
          </div>
        ) : (
          <ul>
            {history.map((t) => (
              <li key={t.id}>
                <button className="box-row exercise exercise--button" onClick={() => edit(t.id, t.date)}>
                  <div>
                    <div>{resultText(t)}</div>
                    <div className="text-muted text-small">
                      {TEST_TITLES[t.type]} · {shortDate(t.date)}
                      {t.note ? ` · ${t.note}` : ''}
                    </div>
                  </div>
                  <ChevronRightIcon className="text-muted exercise-chevron" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
