import type { PlanWeek } from '../schema';
import { TOTAL_WEEKS } from '../plan';
import { WeekProgress } from './WeekProgress';

const KIND: Record<PlanWeek['kind'], { text: string; tone?: 'attention' }> = {
  build: { text: 'Build week' },
  lighter: { text: 'Lighter week', tone: 'attention' },
  test: { text: 'Test week', tone: 'attention' },
};

/** "Monday, 16 Nov" with the week, block and kind labels under it. */
export function DayHeader({ title, week }: { title: string; week: PlanWeek }) {
  const kind = KIND[week.kind];
  return (
    <header className="page-head">
      <h1 className="page-title">{title}</h1>
      <div className="meta-row">
        <span className="text-muted">
          Week {week.week} of {TOTAL_WEEKS}
        </span>
        <span className="label">Block {week.block}</span>
        <span className={`label${kind.tone ? ` label--${kind.tone}` : ''}`}>{kind.text}</span>
      </div>
      <WeekProgress week={week.week} />
      {week.notes && <p className="text-muted">{week.notes}</p>}
    </header>
  );
}
