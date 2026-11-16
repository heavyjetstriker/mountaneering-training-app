import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BeakerIcon,
  CalendarIcon,
  KebabHorizontalIcon,
  LocationIcon,
  SunIcon,
  type Icon,
} from '@primer/octicons-react';
import type { Plan } from './schema';
import { isValidISO, localISO, shortDate } from './dates';
import { TodayView } from './views/TodayView';
import { WeekView } from './views/WeekView';
import { Placeholder } from './views/Placeholder';
import { StrengthLog } from './views/StrengthLog';
import { CardioLog } from './views/CardioLog';
import { LogActionsContext, type LogActions, type LogTarget } from './logContext';
import { logKind } from './logs';
import { getStore, useStore } from './store';
import { buildEffectivePlan } from './plan';
import { MoreView } from './views/MoreView';
import { ensurePersisted, useAppUpdate } from './pwa';
import { Flash } from './components/Flash';

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

const NOTICE_MS = 4000;

export function App({ plan: basePlan }: { plan: Plan }) {
  const [tab, setTab] = useState<Tab>('today');
  const update = useAppUpdate();
  useEffect(ensurePersisted, []);
  const realToday = useToday();
  const preview = previewDate();
  const today = preview ?? realToday;
  const { corruptCopyKey, saveFailed, data } = useStore();
  // Rule 7: every screen reads plan.json with my changes applied.
  const effective = useMemo(() => buildEffectivePlan(basePlan, data.overrides), [basePlan, data.overrides]);
  const plan = effective;

  // The log screen opens full-screen over the current tab; the tab stays mounted underneath.
  const [logging, setLogging] = useState<LogTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const scrollY = useRef(0);
  const actions = useMemo<LogActions>(
    () => ({
      openLog(target) {
        scrollY.current = window.scrollY;
        setNotice(null);
        setLogging(target);
        window.scrollTo(0, 0);
      },
      notify(text) {
        setNotice(text);
      },
      openMore(section) {
        setTab('more');
        requestAnimationFrame(() => {
          const el = section && document.getElementById(section);
          if (el) el.scrollIntoView({ block: 'start' });
          else window.scrollTo(0, 0);
        });
      },
    }),
    [],
  );
  const closeLog = (saved?: string) => {
    setLogging(null);
    if (saved) setNotice(saved);
    requestAnimationFrame(() => window.scrollTo(0, scrollY.current));
  };

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(t);
  }, [notice]);

  const saveFlash = saveFailed && (
    <Flash tone="danger" onDismiss={() => getStore().dismissSaveError()}>
      Couldn't save. Your last change wasn't stored.
    </Flash>
  );

  return (
    <LogActionsContext.Provider value={actions}>
      <div className="app">
        {preview && (
          <div className="preview-bar">
            Previewing {shortDate(preview)}. <a href={window.location.pathname}>Back to today</a>
          </div>
        )}
        {logging && (
          <main className="screen screen--log">
            {saveFlash && <div className="notices">{saveFlash}</div>}
            {logKind(logging.type) === 'strength' ? (
              <StrengthLog key={`${logging.date}-${logging.type}`} plan={plan} target={logging} onClose={closeLog} />
            ) : (
              <CardioLog key={`${logging.date}-${logging.type}`} plan={plan} target={logging} onClose={closeLog} />
            )}
          </main>
        )}
        <main className="screen" hidden={!!logging}>
          {(saveFlash || notice || update.ready || (corruptCopyKey && tab === 'today')) && (
            <div className="notices">
              {saveFlash}
              {update.ready && (
                <Flash
                  tone="neutral"
                  action={
                    <button className="btn flash-action" onClick={update.reload}>
                      Reload
                    </button>
                  }
                >
                  A new version is ready.
                </Flash>
              )}
              {corruptCopyKey && tab === 'today' && (
                <Flash tone="danger" onDismiss={() => getStore().dismissCorruptNotice()}>
                  Saved data couldn't be read, so the app started empty. A copy was kept for recovery.
                </Flash>
              )}
              {notice && <Flash tone="success">{notice}</Flash>}
            </div>
          )}
          {tab === 'today' && <TodayView plan={plan} today={today} />}
          {tab === 'week' && <WeekView plan={plan} today={today} />}
          {tab === 'tests' && (
            <Placeholder
              title="Tests"
              text="Drift, threshold and vertical test results, your Zone 2 range and the intervals switch arrive in milestone 5."
            />
          )}
          {tab === 'trips' && (
            <Placeholder title="Trips" text="Planned and done hikes, with route links, arrive in milestone 6." />
          )}
          {tab === 'more' && <MoreView basePlan={basePlan} plan={plan} today={today} />}
        </main>
        {!logging && (
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
        )}
      </div>
    </LogActionsContext.Provider>
  );
}
