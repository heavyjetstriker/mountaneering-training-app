import { LinkExternalIcon } from '@primer/octicons-react';
import type { Trip } from '../logSchema';
import { DAY_NAMES, shortDate, weekdayOf } from '../dates';
import { getStore, useAppData } from '../store';
import { useLogActions } from '../logContext';
import { groupTrips, linkHost, tripLine, tripTotals, upsertTrip } from '../trips';

export function RouteLink({ url }: { url: string }) {
  return (
    <a className="btn btn-route" href={url} target="_blank" rel="noopener noreferrer" aria-label={`Route on ${linkHost(url)}`}>
      Route <LinkExternalIcon size={14} />
    </a>
  );
}

function TripRow({ trip, today }: { trip: Trip; today: string }) {
  const { openTripForm, notify } = useLogActions();
  const passed = trip.status === 'planned' && trip.date < today;
  const canMarkDone = trip.status === 'planned' && trip.date <= today;
  const markDone = () => {
    const store = getStore();
    if (store.save(upsertTrip(store.getState().data, { ...trip, status: 'done' }))) notify('Marked done.');
  };
  return (
    <li className="box-row trip-row">
      <button className="trip-main" onClick={() => openTripForm({ date: trip.date, editId: trip.id })}>
        <span className="text-muted text-small">
          {DAY_NAMES[weekdayOf(trip.date)].slice(0, 3)} {shortDate(trip.date)}
          {passed && <span className="label trip-label">Date passed</span>}
        </span>
        <span className="trip-route">{trip.route}</span>
        <span className="text-muted text-small">{tripLine(trip)}</span>
      </button>
      {(trip.link || canMarkDone) && (
        <div className="trip-actions">
          {trip.link && <RouteLink url={trip.link} />}
          {canMarkDone && (
            <button className="btn" onClick={markDone}>
              Mark done
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/** Trips tab: planned hikes on top, done hikes below. */
export function TripsView({ today }: { today: string }) {
  const { trips } = useAppData();
  const { openTripForm } = useLogActions();
  const { planned, done } = groupTrips(trips);
  const totals = tripTotals(done);
  const add = (
    <div>
      <button className="btn btn-primary" onClick={() => openTripForm({ date: today })}>
        Add a trip
      </button>
    </div>
  );

  if (trips.length === 0) {
    return (
      <section className="stack">
        <div className="blankslate">
          <h1 className="page-title">Trips</h1>
          <p className="text-muted">Plan your hikes here, with a Komoot or Wikiloc link.</p>
        </div>
        {add}
      </section>
    );
  }

  return (
    <section className="stack">
      <h1 className="page-title">Trips</h1>
      {add}
      <article className="box">
        <header className="box-header">
          <h2 className="box-title">Planned</h2>
          {planned.length > 0 && <span className="box-meta">{planned.length}</span>}
        </header>
        {planned.length === 0 ? (
          <p className="box-row text-muted">Nothing planned. Add your next Saturday hike.</p>
        ) : (
          <ul>
            {planned.map((t) => (
              <TripRow key={t.id} trip={t} today={today} />
            ))}
          </ul>
        )}
      </article>
      <article className="box">
        <header className="box-header">
          <h2 className="box-title">Done</h2>
          {totals.count > 0 && (
            <span className="box-meta">
              {[
                `${totals.count} ${totals.count === 1 ? 'hike' : 'hikes'}`,
                totals.km ? `${totals.km} km` : '',
                totals.climbM ? `${totals.climbM.toLocaleString('en-GB')} m` : '',
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          )}
        </header>
        {done.length === 0 ? (
          <p className="box-row text-muted">No hikes done yet.</p>
        ) : (
          <ul>
            {done.map((t) => (
              <TripRow key={t.id} trip={t} today={today} />
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
