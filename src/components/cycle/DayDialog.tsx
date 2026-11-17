import { useState } from 'react';
import { ArrowUpIcon, PlusIcon, XIcon } from '@primer/octicons-react';
import type { Plan, SessionType } from '../../schema';
import { dayChoices, KIND_TEXT } from '../../cycles';
import { Dialog } from '../Dialog';

/**
 * Which sessions fall on a day, in order. Used for the weekly pattern and for one week's own day
 * (then "Use the weekly pattern" goes back to it).
 */
export function DayDialog({
  plan,
  title,
  initial,
  onSave,
  onUsePattern,
  onClose,
}: {
  plan: Plan;
  title: string;
  initial: SessionType[];
  onSave: (list: SessionType[]) => void;
  /** Only for a week's own day. */
  onUsePattern?: () => void;
  onClose: () => void;
}) {
  const [list, setList] = useState<SessionType[]>(() => initial.filter((t) => plan.templates[t]?.kind !== 'rest'));
  const choices = dayChoices(plan).filter((t) => !list.includes(t.type));
  const up = (i: number) => {
    const next = [...list];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setList(next);
  };

  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          {onUsePattern && (
            <button className="btn-invisible" onClick={onUsePattern}>
              Use the weekly pattern
            </button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={() => onSave(list)}>
            Save
          </button>
        </>
      }
    >
      {list.length === 0 ? (
        <p className="box-row text-muted">Rest day. Add a session below.</p>
      ) : (
        <ol>
          {list.map((t, i) => (
            <li key={t} className="box-row pick-row">
              <span className="pick-name">
                {i > 0 && <span className="text-muted text-small">then</span>}
                <span className="option-name">{plan.templates[t]?.title ?? `Missing session (${t})`}</span>
              </span>
              <button className="btn-invisible btn-icon" aria-label={`Move ${plan.templates[t]?.title ?? t} up`} disabled={i === 0} onClick={() => up(i)}>
                <ArrowUpIcon />
              </button>
              <button
                className="btn-invisible btn-icon btn-invisible--muted"
                aria-label={`Remove ${plan.templates[t]?.title ?? t}`}
                onClick={() => setList(list.filter((x) => x !== t))}
              >
                <XIcon />
              </button>
            </li>
          ))}
        </ol>
      )}
      {choices.length > 0 && <p className="box-row box-row--note">Add a session</p>}
      {choices.map((t) => (
        <button key={t.type} className="box-row option-row" onClick={() => setList([...list, t.type])}>
          <span className="option-day">
            <span className="option-name">{t.title}</span>
            <span className="text-muted text-small">{KIND_TEXT[t.kind]}</span>
          </span>
          <PlusIcon className="text-muted" />
        </button>
      ))}
      {dayChoices(plan).length === 0 && (
        <p className="box-row text-muted">No sessions yet. Add them in Sessions first.</p>
      )}
    </Dialog>
  );
}
