import { HIKE_KINDS, type ResolvedSession } from '../plan';
import { useAppData } from '../store';
import { useLogActions } from '../logContext';
import { tripLine, tripsOn } from '../trips';
import { RouteLink } from '../views/TripsView';

/** On a hike card: the route planned (or done) that day, or "Plan a route". */
export function TripRows({ session, date, today }: { session: ResolvedSession; date: string; today: string }) {
  const { trips } = useAppData();
  const { openTripForm } = useLogActions();
  const hike = HIKE_KINDS.includes(session.kind);
  if (!hike && session.kind !== 'recovery') return null;
  const onDay = tripsOn(trips, date);

  if (onDay.length === 0) {
    if (!hike || date < today) return null;
    return (
      <div className="box-row trip-plan">
        <button className="link-button" onClick={() => openTripForm({ date, fixedDate: true })}>
          Plan a route
        </button>
      </div>
    );
  }

  return (
    <>
      {onDay.map((t) => (
        <div className="box-row trip-row" key={t.id}>
          <button className="trip-main" onClick={() => openTripForm({ date, editId: t.id })}>
            <span>
              {t.status === 'done' ? 'Done' : 'Planned'}: {t.route}
            </span>
            <span className="text-muted text-small">{tripLine(t)}</span>
          </button>
          {t.link && (
            <div className="trip-actions">
              <RouteLink url={t.link} />
            </div>
          )}
        </div>
      ))}
    </>
  );
}
