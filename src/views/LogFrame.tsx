import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ChevronLeftIcon } from '@primer/octicons-react';
import { longDate } from '../dates';
import { Dialog } from '../components/Dialog';

/**
 * Full-screen frame shared by the log screens: Cancel, title and date on top,
 * a sticky Save button at the bottom, the discard and delete dialogs, and the
 * phone's back button treated as Cancel.
 */
export function LogFrame({
  title,
  date,
  dirty,
  canDelete,
  onSave,
  onDiscard,
  onDelete,
  children,
  words = LOG_WORDS,
}: {
  title: string;
  date: string;
  dirty: boolean;
  canDelete: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onDelete: () => void;
  children: ReactNode;
  /** Button and dialog wording; the test result form uses its own. */
  words?: FrameWords;
}) {
  const [dialog, setDialog] = useState<'discard' | 'delete' | null>(null);
  const cancelRef = useRef<() => void>(() => {});
  const popped = useRef(false);

  const cancel = () => {
    if (dirty) setDialog('discard');
    else onDiscard();
  };
  cancelRef.current = cancel;

  // Android back: one history entry for the log screen, so back means Cancel, not "leave the app".
  useEffect(() => {
    window.history.pushState({ mtaLog: true }, '');
    const onPop = () => {
      popped.current = true;
      cancelRef.current();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (!popped.current) window.history.back();
    };
  }, []);

  // If back was pressed with unsaved changes, the dialog is open: put the entry back.
  useEffect(() => {
    if (dialog === 'discard' && popped.current) {
      popped.current = false;
      window.history.pushState({ mtaLog: true }, '');
    }
  }, [dialog]);

  return (
    <section className="log-screen">
      <header className="log-head">
        <button className="btn-invisible back" onClick={cancel}>
          <ChevronLeftIcon /> Cancel
        </button>
        <h1 className="page-title">{title}</h1>
        <p className="text-muted">{longDate(date).replace(' ', ', ')}</p>
      </header>

      <div className="stack">
        {children}
        {canDelete && (
          <div>
            <button className="btn-invisible btn-invisible--danger" onClick={() => setDialog('delete')}>
              {words.delete}
            </button>
          </div>
        )}
      </div>

      <div className="save-bar">
        <button className="btn btn-primary btn-block" onClick={onSave}>
          {words.save}
        </button>
      </div>

      {dialog === 'discard' && (
        <Dialog
          title={words.discardTitle}
          onClose={() => setDialog(null)}
          footer={
            <>
              <button className="btn" onClick={() => setDialog(null)}>
                Keep editing
              </button>
              <button className="btn btn-danger" onClick={onDiscard}>
                Discard
              </button>
            </>
          }
        >
          <p className="box-row text-muted">What you entered won't be saved.</p>
        </Dialog>
      )}
      {dialog === 'delete' && (
        <Dialog
          title={words.deleteTitle}
          onClose={() => setDialog(null)}
          footer={
            <>
              <button className="btn" onClick={() => setDialog(null)}>
                Keep it
              </button>
              <button className="btn btn-danger" onClick={onDelete}>
                Delete
              </button>
            </>
          }
        >
          <p className="box-row text-muted">{words.deleteBody}</p>
        </Dialog>
      )}
    </section>
  );
}

export interface FrameWords {
  save: string;
  delete: string;
  discardTitle: string;
  deleteTitle: string;
  deleteBody: string;
}

const LOG_WORDS: FrameWords = {
  save: 'Save log',
  delete: 'Delete log',
  discardTitle: 'Discard this log?',
  deleteTitle: 'Delete this log?',
  deleteBody: 'The session goes back to not logged.',
};

/** '82,5' or '82.5' → 82.5; empty or not a number → null. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function numberText(n: number | null | undefined): string {
  return n === null || n === undefined ? '' : String(Math.round(n * 100) / 100);
}
