import { useEffect, useState } from 'react';
import type { Day } from '../schema';
import type { ResolvedSession } from '../plan';
import type { SessionLog } from '../logSchema';
import { getStore, newId, useAppData } from '../store';
import { deleteLog, logFor, logKind, logSummary, STATUS_TEXT, upsertLog } from '../logs';
import { readDraft } from '../drafts';
import { useLogActions } from '../logContext';
import { testsForSession } from '../tests';

const UNDO_MS = 6000;

const STATUS_LABEL: Record<SessionLog['status'], string> = {
  done: 'label--success',
  partial: 'label--attention',
  skipped: '',
};

/** Log / Skip, or the saved status, under a session box. */
export function SessionFooter({
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
  const data = useAppData();
  const { openLog } = useLogActions();
  const [undoId, setUndoId] = useState<string | null>(null);
  const log = logFor(data.logs, date, session.type);

  useEffect(() => {
    if (!undoId) return;
    const t = window.setTimeout(() => setUndoId(null), UNDO_MS);
    return () => window.clearTimeout(t);
  }, [undoId]);

  if (logKind(session.type) === 'none') return null;

  if (date > today) {
    return <p className="box-row box-footer text-muted text-small">You can log this on the day.</p>;
  }

  const target = { date, week, day, type: session.type };

  if (!log) {
    const hasDraft = logKind(session.type) === 'strength' && readDraft(date, session.type) !== null;
    const skip = () => {
      const store = getStore();
      const id = newId();
      store.save(
        upsertLog(store.getState().data, {
          id,
          date,
          week,
          type: session.type,
          status: 'skipped',
          savedAt: new Date().toISOString(),
        }),
      );
      setUndoId(id);
    };
    return (
      <div className="box-row box-footer">
        {/* On a test session, Enter results is the main action. */}
        <button
          className={`btn btn-grow ${testsForSession(session.type).length ? '' : 'btn-primary'}`}
          onClick={() => openLog(target)}
        >
          {hasDraft ? 'Continue log' : 'Log session'}
        </button>
        <button className="btn" onClick={skip}>
          Skip
        </button>
      </div>
    );
  }

  const summary = logSummary(log);
  const undo = () => {
    const store = getStore();
    store.save(deleteLog(store.getState().data, log.id));
    setUndoId(null);
  };

  return (
    <div className="box-row box-footer">
      <span className={`label ${STATUS_LABEL[log.status]}`}>{STATUS_TEXT[log.status]}</span>
      <span className="footer-summary text-muted text-small">{summary}</span>
      {undoId === log.id ? (
        <button className="btn-invisible" onClick={undo}>
          Undo
        </button>
      ) : (
        <button className="btn-invisible" onClick={() => openLog(target)}>
          Edit log
        </button>
      )}
    </div>
  );
}
