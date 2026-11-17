import { describe, expect, it } from 'vitest';
import {
  backupFileName,
  exportAgeText,
  importWarnings,
  makeBackup,
  nearestMonday,
  parseBackup,
  shouldRemindBackup,
  summarize,
} from './backup';
import { emptyAppData, type AppData, type SessionLog } from './logSchema';

const log = (id: string, date: string, savedAt = `${date}T19:00:00.000Z`): SessionLog => ({
  id,
  date,
  week: 1,
  type: 'me',
  status: 'done',
  minutes: 30,
  savedAt,
});

const withLogs = (...logs: SessionLog[]): AppData => ({ ...emptyAppData(), logs });

const sample: AppData = {
  ...withLogs(log('a', '2026-11-16'), log('b', '2026-11-19')),
  overrides: [{ id: 'o1', createdAt: '2026-11-16T10:00:00Z', override: { kind: 'pause', fromWeek: 2, weeks: 1 } }],
};

describe('parseBackup', () => {
  it('round-trips makeBackup', () => {
    const file = makeBackup(sample, new Date('2026-11-20T08:00:00Z'));
    expect(file).toEqual({ app: 'mountain-training-app', exportedAt: '2026-11-20T08:00:00.000Z', data: sample });
    expect(parseBackup(JSON.stringify(file))).toEqual({ ok: true, file });
  });
  it('refuses a file that is not JSON', () => {
    expect(parseBackup('{oops')).toEqual({ ok: false, reason: 'notJson' });
    expect(parseBackup('')).toEqual({ ok: false, reason: 'notJson' });
  });
  it('refuses JSON from somewhere else', () => {
    expect(parseBackup(JSON.stringify({ name: 'package', version: '1.0.0' }))).toEqual({ ok: false, reason: 'notOurs' });
    expect(parseBackup('[1,2]')).toEqual({ ok: false, reason: 'notOurs' });
    expect(parseBackup('null')).toEqual({ ok: false, reason: 'notOurs' });
    expect(parseBackup(JSON.stringify(sample))).toEqual({ ok: false, reason: 'notOurs' }); // raw mta.data, no wrapper
  });
  it('refuses a backup from a newer version', () => {
    const file = makeBackup(sample, new Date());
    const v2 = { ...file, data: { ...file.data, version: 2, somethingNew: [] } };
    expect(parseBackup(JSON.stringify(v2))).toEqual({ ok: false, reason: 'newerVersion' });
  });
  it('refuses a damaged backup (a log with a bad date)', () => {
    const file = makeBackup(sample, new Date());
    const bad = structuredClone(file) as unknown as { data: { logs: { date: string }[] } };
    bad.data.logs[0].date = '16/11/2026';
    expect(parseBackup(JSON.stringify(bad))).toEqual({ ok: false, reason: 'invalid' });
    expect(parseBackup(JSON.stringify({ app: 'mountain-training-app', exportedAt: 'x', data: sample }))).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });
  it('round-trips test results and refuses one with a bad heart rate', () => {
    const t = { id: 't', date: '2026-11-24', savedAt: '2026-11-24T19:00:00.000Z', type: 'threshold' as const, thresholdHr: 162 };
    const file = makeBackup({ ...emptyAppData(), tests: [t] }, new Date('2026-11-25T08:00:00Z'));
    expect(parseBackup(JSON.stringify(file))).toEqual({ ok: true, file });
    const bad = makeBackup({ ...emptyAppData(), tests: [{ ...t, thresholdHr: 400 }] }, new Date());
    expect(parseBackup(JSON.stringify(bad))).toEqual({ ok: false, reason: 'invalid' });
  });
  it('refuses a start date that is not a Monday', () => {
    const data: AppData = {
      ...emptyAppData(),
      overrides: [{ id: 's', createdAt: '2026-11-16T10:00:00Z', override: { kind: 'startDate', date: '2026-11-18' } }],
    };
    expect(parseBackup(JSON.stringify(makeBackup(data, new Date())))).toEqual({ ok: false, reason: 'invalid' });
  });
});

describe('summarize and importWarnings', () => {
  it('summarizes logs, changes and the newest log date', () => {
    expect(summarize(sample)).toEqual({ logs: 2, changes: 1, tests: 0, trips: 0, gear: 0, cycles: 0, newestLog: '2026-11-19' });
    expect(summarize(emptyAppData())).toEqual({ logs: 0, changes: 0, tests: 0, trips: 0, gear: 0, cycles: 0, newestLog: null });
  });
  it('gives no warning for the same data, or a newer file', () => {
    expect(importWarnings(sample, sample)).toEqual([]);
    expect(importWarnings(sample, withLogs(...sample.logs, log('c', '2026-11-21')))).toEqual([]);
    expect(importWarnings(emptyAppData(), sample)).toEqual([]);
  });
  it('warns when the device has an older-looking file coming in', () => {
    const device = withLogs(log('a', '2026-11-16'), log('b', '2026-11-23'));
    const file = withLogs(log('a', '2026-11-16'), log('x', '2026-11-16'));
    expect(importWarnings(device, file)).toEqual(['This device has newer logs (23 Nov) than the file (16 Nov).']);
  });
  it('warns when the device has more logs', () => {
    const device = withLogs(log('a', '2026-11-16'), log('b', '2026-11-16'), log('c', '2026-11-16'));
    expect(importWarnings(device, withLogs(log('a', '2026-11-16')))).toEqual([
      'This device has more logs (3) than the file (1).',
    ]);
  });
  it('warns when the file has no logs at all', () => {
    expect(importWarnings(sample, emptyAppData())).toEqual([
      'This device has logs up to 19 Nov; the file has none.',
      'This device has more logs (2) than the file (0).',
    ]);
  });
});

describe('backupFileName', () => {
  it('uses the local date, also around midnight', () => {
    expect(backupFileName(new Date(2026, 10, 16, 23, 59))).toBe('mountain-training-2026-11-16.json');
    expect(backupFileName(new Date(2026, 10, 17, 0, 1))).toBe('mountain-training-2026-11-17.json');
  });
});

describe('nearestMonday', () => {
  it('keeps Mondays, goes back from Tue–Thu and forward from Fri–Sun', () => {
    expect(nearestMonday('2026-11-16')).toBe('2026-11-16');
    expect(nearestMonday('2026-11-17')).toBe('2026-11-16');
    expect(nearestMonday('2026-11-19')).toBe('2026-11-16');
    expect(nearestMonday('2026-11-20')).toBe('2026-11-23');
    expect(nearestMonday('2026-11-22')).toBe('2026-11-23');
    expect(nearestMonday('2026-12-31')).toBe('2026-12-28');
  });
});

describe('shouldRemindBackup', () => {
  const three = withLogs(
    log('a', '2026-11-16', '2026-11-16T19:00:00.000Z'),
    log('b', '2026-11-17', '2026-11-17T19:00:00.000Z'),
    log('c', '2026-11-18', '2026-11-18T19:00:00.000Z'),
  );
  it('never exported: only once there are 3 logs', () => {
    expect(shouldRemindBackup(withLogs(...three.logs.slice(0, 2)), {}, '2026-11-18')).toBe(false);
    expect(shouldRemindBackup(three, {}, '2026-11-18')).toBe(true);
  });
  it('exported 6 days ago: no', () => {
    const later = withLogs(...three.logs, log('d', '2026-11-24', '2026-11-24T19:00:00.000Z'));
    expect(shouldRemindBackup(later, { lastExportAt: '2026-11-19T12:00:00.000Z' }, '2026-11-25')).toBe(false);
  });
  it('exported 7 days ago with new logs since: yes', () => {
    const later = withLogs(...three.logs, log('d', '2026-11-24', '2026-11-24T19:00:00.000Z'));
    expect(shouldRemindBackup(later, { lastExportAt: '2026-11-19T12:00:00.000Z' }, '2026-11-26')).toBe(true);
  });
  it('exported 7 days ago with no new logs: no', () => {
    expect(shouldRemindBackup(three, { lastExportAt: '2026-11-19T12:00:00.000Z' }, '2026-11-30')).toBe(false);
  });
  it('says how long ago in plain words', () => {
    const meta = { lastExportAt: '2026-11-16T12:00:00.000Z' };
    expect(exportAgeText({}, '2026-11-16')).toBe('never');
    expect(exportAgeText(meta, '2026-11-16')).toBe('today');
    expect(exportAgeText(meta, '2026-11-17')).toBe('yesterday');
    expect(exportAgeText(meta, '2026-11-19')).toBe('3 days ago');
  });
});
