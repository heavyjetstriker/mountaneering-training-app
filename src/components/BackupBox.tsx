import { useRef, useState, type ChangeEvent } from 'react';
import { AlertIcon } from '@primer/octicons-react';
import {
  backupFileName,
  exportAgeText,
  importWarnings,
  makeBackup,
  parseBackup,
  plural,
  PARSE_MESSAGES,
  summarize,
  type BackupFile,
  type Summary,
} from '../backup';
import { localISO, shortDate } from '../dates';
import { importData } from '../actions';
import { useAppData } from '../store';
import { recordExport, useMeta } from '../meta';
import { useStorageStatus, type StorageStatus } from '../pwa';
import { useLogActions } from '../logContext';
import { Dialog } from './Dialog';
import { Flash } from './Flash';

const STORAGE_TEXT: Record<StorageStatus, string> = {
  checking: 'Storage: checking…',
  kept: "Storage: kept, the browser won't clear it",
  notGuaranteed: 'Storage: not guaranteed. Export regularly.',
  unknown: 'Storage: unknown',
};

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** "16 Nov, 19:40" in local time. */
function whenText(iso: string): string {
  const d = new Date(iso);
  const hm = [d.getHours(), d.getMinutes()].map((n) => String(n).padStart(2, '0')).join(':');
  return `${shortDate(localISO(d))}, ${hm}`;
}

function contentsText(s: Pick<Summary, 'logs' | 'changes' | 'tests' | 'trips' | 'gear' | 'cycles'>): string {
  const parts = [plural(s.logs, 'log'), plural(s.changes, 'plan change')];
  if (s.tests) parts.push(plural(s.tests, 'test result'));
  if (s.trips) parts.push(plural(s.trips, 'trip'));
  if (s.gear) parts.push(plural(s.gear, 'gear item'));
  if (s.cycles) parts.push(plural(s.cycles, 'training cycle'));
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

function ImportDialog({ file, onCancel, onDone }: { file: BackupFile; onCancel: () => void; onDone: (error?: string) => void }) {
  const device = useAppData();
  const here = summarize(device);
  const incoming = summarize(file.data);
  const warnings = importWarnings(device, file.data);

  const replace = () => {
    onDone(importData(file.data) ? undefined : "Couldn't import: storage on this device is full or blocked. Nothing changed.");
  };

  return (
    <Dialog
      title="Replace the data on this device?"
      onClose={onCancel}
      footer={
        <>
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-danger" onClick={replace}>
            Replace
          </button>
        </>
      }
    >
      <p className="box-row box-row--note">
        Everything on this device is replaced by the file. Nothing is merged. A copy of the current data stays on this
        device for recovery.
      </p>
      <table className="compare">
        <thead>
          <tr className="box-row">
            <th scope="col">
              <span className="sr-only">What</span>
            </th>
            <th scope="col">File</th>
            <th scope="col">This device</th>
          </tr>
        </thead>
        <tbody>
          <tr className="box-row">
            <th scope="row">Exported</th>
            <td>{whenText(file.exportedAt)}</td>
            <td>–</td>
          </tr>
          <tr className="box-row">
            <th scope="row">Logs</th>
            <td>{incoming.logs}</td>
            <td>{here.logs}</td>
          </tr>
          <tr className="box-row">
            <th scope="row">Plan changes</th>
            <td>{incoming.changes}</td>
            <td>{here.changes}</td>
          </tr>
          <tr className="box-row">
            <th scope="row">Test results</th>
            <td>{incoming.tests}</td>
            <td>{here.tests}</td>
          </tr>
          <tr className="box-row">
            <th scope="row">Trips</th>
            <td>{incoming.trips}</td>
            <td>{here.trips}</td>
          </tr>
          <tr className="box-row">
            <th scope="row">Gear items</th>
            <td>{incoming.gear}</td>
            <td>{here.gear}</td>
          </tr>
          <tr className="box-row">
            <th scope="row">Training cycles</th>
            <td>{incoming.cycles}</td>
            <td>{here.cycles}</td>
          </tr>
          <tr className="box-row">
            <th scope="row">Newest log</th>
            <td>{incoming.newestLog ? shortDate(incoming.newestLog) : 'none'}</td>
            <td>{here.newestLog ? shortDate(here.newestLog) : 'none'}</td>
          </tr>
        </tbody>
      </table>
      {warnings.map((w) => (
        <p key={w} className="box-row warning-row">
          <AlertIcon className="warning-icon" />
          <span>{w}</span>
        </p>
      ))}
    </Dialog>
  );
}

export function BackupBox({ today }: { today: string }) {
  const data = useAppData();
  const meta = useMeta();
  const storage = useStorageStatus();
  const { notify } = useLogActions();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<BackupFile | null>(null);
  const [busy, setBusy] = useState(false);

  const exportData = async () => {
    setError(null);
    const now = new Date();
    const name = backupFileName(now);
    const json = JSON.stringify(makeBackup(data, now), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const file = new File([blob], name, { type: 'application/json' });
    setBusy(true);
    try {
      // Android: the share sheet (Drive, email, the PC). Elsewhere, or if sharing fails: a download.
      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: name });
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return; // I closed the share sheet
          download(blob, name);
        }
      } else {
        download(blob, name);
      }
      recordExport(now);
      notify(`Exported ${contentsText(summarize(data))}.`);
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ''; // picking the same file again still fires
    if (!f) return;
    setError(null);
    let text = '';
    try {
      text = await f.text();
    } catch {
      setError("That file couldn't be read, so nothing was imported.");
      return;
    }
    const result = parseBackup(text);
    if (result.ok) setPending(result.file);
    else setError(PARSE_MESSAGES[result.reason]);
  };

  const finishImport = (failed?: string) => {
    const file = pending;
    setPending(null);
    if (failed) setError(failed);
    else if (file) notify(`Imported ${contentsText(summarize(file.data))}.`);
  };

  return (
    <article className="box" id="backup">
      <header className="box-header">
        <h2 className="box-title">Backup</h2>
      </header>
      <p className="box-row box-row--note">
        All your logs, plan changes, test results, trips and gear in one file. Export it to keep a copy, or to move to your PC and import it there.
      </p>
      {error && (
        <div className="box-row box-row--flash">
          <Flash tone="danger" onDismiss={() => setError(null)}>
            {error}
          </Flash>
        </div>
      )}
      <p className="box-row">{STORAGE_TEXT[storage]}</p>
      <p className="box-row">Last export: {exportAgeText(meta, today)}</p>
      <div className="box-row button-row">
        <button className="btn btn-primary btn-grow" onClick={exportData} disabled={busy}>
          Export data
        </button>
        <button className="btn btn-grow" onClick={() => input.current?.click()}>
          Import data
        </button>
        <input ref={input} type="file" accept="application/json,.json" hidden onChange={pickFile} aria-label="Backup file" />
      </div>
      {pending && <ImportDialog file={pending} onCancel={() => setPending(null)} onDone={finishImport} />}
    </article>
  );
}
