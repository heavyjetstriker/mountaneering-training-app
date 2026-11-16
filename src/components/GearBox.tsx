import { useState, type FormEvent } from 'react';
import type { Plan } from '../schema';
import type { AppData, GearItem } from '../logSchema';
import { getStore, newId, useAppData } from '../store';
import { useLogActions } from '../logContext';
import { addStarter, deleteGear, groupGear, toggleGear, upsertGear } from '../gear';
import { Dialog } from './Dialog';

function save(next: (d: AppData) => AppData): boolean {
  const store = getStore();
  return store.save(next(store.getState().data));
}

function GearDialog({ item, onClose }: { item: GearItem; onClose: () => void }) {
  const { notify } = useLogActions();
  const [name, setName] = useState(item.name);
  const [note, setNote] = useState(item.note ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const trimmed = name.trim();

  if (confirmDelete) {
    return (
      <Dialog
        title={`Delete ${item.name}?`}
        onClose={() => setConfirmDelete(false)}
        footer={
          <>
            <button className="btn" onClick={() => setConfirmDelete(false)}>
              Keep it
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (save((d) => deleteGear(d, item.id))) notify(`${item.name} deleted.`);
                onClose();
              }}
            >
              Delete
            </button>
          </>
        }
      >
        <p className="box-row text-muted">It is removed from your gear list.</p>
      </Dialog>
    );
  }

  return (
    <Dialog
      title="Edit gear"
      onClose={onClose}
      footer={
        <>
          <button className="btn-invisible btn-invisible--danger" onClick={() => setConfirmDelete(true)}>
            Delete
          </button>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            disabled={!trimmed || trimmed.length > 60}
            onClick={() => {
              const n = note.trim();
              const next: GearItem = { ...item, name: trimmed };
              if (n) next.note = n;
              else delete next.note;
              save((d) => upsertGear(d, next));
              onClose();
            }}
          >
            Save
          </button>
        </>
      }
    >
      <label className="box-row field">
        <span className="field-label">Name</span>
        <input className="input input--grow" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="box-row field field--stacked">
        <span className="field-label">Note</span>
        <textarea
          className="input textarea"
          rows={2}
          placeholder="Size, model, where to buy"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
    </Dialog>
  );
}

function GearRow({ item, onOpen }: { item: GearItem; onOpen: () => void }) {
  const have = item.status === 'have';
  return (
    <li className="box-row gear-row">
      <label className="gear-check">
        <input
          type="checkbox"
          checked={have}
          aria-label={`${item.name}: ${have ? 'have' : 'need'}`}
          onChange={() => save((d) => toggleGear(d, item.id))}
        />
      </label>
      <button className={`gear-name${have ? ' gear-name--have' : ''}`} onClick={onOpen}>
        <span>{item.name}</span>
        {item.note && <span className="text-muted text-small">{item.note}</span>}
      </button>
    </li>
  );
}

/** More → Gear: a need / have checklist. */
export function GearBox({ plan }: { plan: Plan }) {
  const { gear } = useAppData();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<GearItem | null>(null);
  const { need, have } = groupGear(gear);
  const starter = plan.starterGear ?? [];

  const add = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim().replace(/\s+/g, ' ');
    if (!n) return;
    if (save((d) => upsertGear(d, { id: newId(), name: n.slice(0, 60), status: 'need', savedAt: new Date().toISOString() })))
      setName('');
  };

  return (
    <article className="box" id="gear">
      <header className="box-header">
        <h2 className="box-title">Gear</h2>
        {gear.length > 0 && (
          <span className="box-meta">
            {have.length} of {gear.length}
          </span>
        )}
      </header>
      {gear.length === 0 ? (
        <div className="box-row gear-empty">
          <span className="text-muted">No gear yet.</span>
          {starter.length > 0 && (
            <button className="btn" onClick={() => save((d) => addStarter(d, starter, new Date(), newId))}>
              Add the starter list
            </button>
          )}
        </div>
      ) : (
        <ul>
          {[...need, ...have].map((g) => (
            <GearRow key={g.id} item={g} onOpen={() => setEditing(g)} />
          ))}
        </ul>
      )}
      <form className="box-row gear-add" onSubmit={add}>
        <input
          className="input input--grow"
          value={name}
          maxLength={60}
          placeholder="Add an item"
          aria-label="New gear item"
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn" type="submit" disabled={!name.trim()}>
          Add
        </button>
      </form>
      {editing && <GearDialog item={editing} onClose={() => setEditing(null)} />}
    </article>
  );
}
