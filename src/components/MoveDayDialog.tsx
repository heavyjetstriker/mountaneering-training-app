import { useState } from 'react';
import { ChevronRightIcon } from '@primer/octicons-react';
import type { Day, Plan } from '../schema';
import { DAY_NAMES, DAY_ORDER, shortDate } from '../dates';
import { dateOf, sessionTypesFor } from '../plan';
import { commitOverride } from '../actions';
import { useLogActions } from '../logContext';
import { Dialog } from './Dialog';

/** Move all of a day's sessions to another day of the same week. Friday asks first. */
export function MoveDayDialog({ plan, week, day, onClose }: { plan: Plan; week: number; day: Day; onClose: () => void }) {
  const { notify } = useLogActions();
  const [confirmFriday, setConfirmFriday] = useState(false);

  const move = (to: Day) => {
    commitOverride({ kind: 'moveDay', week, from: day, to });
    notify(`${DAY_NAMES[day]} moved to ${DAY_NAMES[to]}.`);
    onClose();
  };

  if (confirmFriday) {
    return (
      <Dialog
        title="Train on Friday?"
        onClose={onClose}
        footer={
          <>
            <button className="btn" onClick={() => setConfirmFriday(false)}>
              Pick another day
            </button>
            <button className="btn btn-primary" onClick={() => move('fri')}>
              Move to Friday
            </button>
          </>
        }
      >
        <p className="box-row text-muted">
          Friday is your rest day. {DAY_NAMES[day]}'s sessions will replace it this week.
        </p>
      </Dialog>
    );
  }

  return (
    <Dialog
      title={`Move ${DAY_NAMES[day]}`}
      onClose={onClose}
      footer={
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
      }
    >
      <p className="box-row box-row--note">
        All of {DAY_NAMES[day]}'s sessions move together, week {week} only. They go after anything already on that day.
      </p>
      <ul>
        {DAY_ORDER.filter((d) => d !== day).map((d) => {
          const titles = sessionTypesFor(plan, week, d).map((t) => plan.templates[t].title);
          return (
            <li key={d}>
              <button className="box-row option-row" onClick={() => (d === 'fri' ? setConfirmFriday(true) : move(d))}>
                <span className="option-day">
                  <span className="option-name">
                    {DAY_NAMES[d]}, {shortDate(dateOf(plan, week, d))}
                  </span>
                  <span className="text-muted text-small">{titles.join(', then ')}</span>
                </span>
                <ChevronRightIcon className="text-muted" />
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
