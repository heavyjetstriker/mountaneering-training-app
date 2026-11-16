import { useEffect, useState } from 'react';
import { BeakerIcon, CalendarIcon, KebabHorizontalIcon, LocationIcon, SunIcon, type Icon } from '@primer/octicons-react';
import type { Plan } from './schema';
import { isValidISO, localISO, shortDate } from './dates';
import { TodayView } from './views/TodayView';
import { WeekView } from './views/WeekView';
import { Placeholder } from './views/Placeholder';

type Tab = 'today' | 'week' | 'tests' | 'trips' | 'more';

const TABS: { id: Tab; label: string; Icon: Icon }[] = [
  { id: 'today', label: 'Today', Icon: SunIcon },
  { id: 'week', label: 'Week', Icon: CalendarIcon },
  { id: 'tests', label: 'Tests', Icon: BeakerIcon },
  { id: 'trips', label: 'Trips', Icon: LocationIcon },
  { id: 'more', label: 'More', Icon: KebabHorizontalIcon },
];

/** ?date=YYYY-MM-DD lets me preview any day of the plan. */
function previewDate(): string | null {
  const d = new URLSearchParams(window.location.search).get('date');
  return d && isValidISO(d) ? d : null;
}

function useToday(): string {
  const [today, setToday] = useState(localISO());
  useEffect(() => {
    // Roll over at midnight, or when the app comes back from the background.
    const tick = () => setToday(localISO());
    const id = window.setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return today;
}

export function App({ plan }: { plan: Plan }) {
  const [tab, setTab] = useState<Tab>('today');
  const realToday = useToday();
  const preview = previewDate();
  const today = preview ?? realToday;

  return (
    <div className="app">
      {preview && (
        <div className="preview-bar">
          Previewing {shortDate(preview)}.{' '}
          <a href={window.location.pathname}>Back to today</a>
        </div>
      )}
      <main className="screen">
        {tab === 'today' && <TodayView plan={plan} today={today} />}
        {tab === 'week' && <WeekView plan={plan} today={today} />}
        {tab === 'tests' && (
          <Placeholder title="Tests" text="Drift, threshold and vertical test results, your Zone 2 range and the intervals switch arrive in milestone 5." />
        )}
        {tab === 'trips' && (
          <Placeholder title="Trips" text="Planned and done hikes, with route links, arrive in milestone 6." />
        )}
        {tab === 'more' && (
          <Placeholder title="More" text="Gear checklist, your plan changes, settings and backup arrive in milestones 3, 4 and 6." />
        )}
      </main>
      <nav className="tabbar" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            className="tab"
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => {
              setTab(t.id);
              window.scrollTo(0, 0);
            }}
          >
            <t.Icon size={20} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
