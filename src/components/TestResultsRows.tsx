import type { Day } from '../schema';
import type { ResolvedSession } from '../plan';
import { useAppData } from '../store';
import { useLogActions } from '../logContext';
import { resultText, sortResults, TEST_TITLES } from '../tests';

/** On a test session: Enter results, or the results saved for that day with Edit. */
export function TestResultsRows({
  session,
  date,
  today,
  week,
  day,
}: {
  session: ResolvedSession;
  date: string;
  today: string;
  week: number;
  day: Day;
}) {
  const { tests } = useAppData();
  const { openTestForm } = useLogActions();
  const types = session.tests ?? [];
  if (types.length === 0 || date > today) return null;

  const sessionTarget = { date, week, day, type: session.type };
  const onDay = sortResults(tests).filter((t) => t.date === date);
  const found = types.map((type) => ({ type, result: onDay.filter((t) => t.type === type).pop() }));

  if (found.every((f) => !f.result)) {
    return (
      <div className="box-row box-footer">
        <button className="btn btn-primary btn-grow" onClick={() => openTestForm({ types, date, session: sessionTarget })}>
          Enter results
        </button>
      </div>
    );
  }

  return (
    <div className="box-row test-results">
      {found.map(({ type, result }) =>
        result ? (
          <div className="test-result-line" key={type}>
            <span>{resultText(result)}</span>
            <button
              className="btn-invisible"
              aria-label={`Edit ${TEST_TITLES[type].toLowerCase()}`}
              onClick={() => openTestForm({ types: [type], date, editId: result.id })}
            >
              Edit
            </button>
          </div>
        ) : (
          <div className="test-result-line" key={type}>
            <span className="text-muted">{EMPTY_LINE[type]}</span>
            <button
              className="btn-invisible"
              onClick={() => openTestForm({ types: [type], date, session: sessionTarget })}
            >
              Add
            </button>
          </div>
        ),
      )}
    </div>
  );
}

const EMPTY_LINE = { drift: 'No drift result', threshold: 'No threshold result', vertical: 'No vertical result' } as const;
