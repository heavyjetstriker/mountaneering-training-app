import { useCallback, useEffect, useRef, useState } from 'react';
import { clock, DEFAULT_REST, remaining, REST_PRESETS } from '../rest';
import { setRestSeconds, useMeta } from '../meta';
import { Segmented } from './Segmented';

const TICK_MS = 250;
const OVER_MS = 10_000;

type Lock = { release(): Promise<void> } | null;

/** Two short tones. The AudioContext is created on the Start tap, so the browser lets it play. */
function beep(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    [880, 1320].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.15, t + i * 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.2 + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t + i * 0.2);
      osc.stop(t + i * 0.2 + 0.2);
    });
  } catch {
    /* no sound is fine */
  }
}

/**
 * Rest timer for the log screens. Time-stamp based, so it stays right after the phone sleeps.
 * `planRest` is the plan's own rest length (Thursday "2 min rest"); otherwise my last choice.
 */
export function RestTimer({ planRest }: { planRest?: number | null }) {
  const meta = useMeta();
  const [length, setLength] = useState<number>(planRest ?? meta.restSeconds ?? DEFAULT_REST);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [over, setOver] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const lock = useRef<Lock>(null);

  const keepAwake = useCallback(async () => {
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request(t: 'screen'): Promise<Lock> } }).wakeLock;
      if (wl && !lock.current) lock.current = await wl.request('screen');
    } catch {
      /* the browser said no: the timer still works */
    }
  }, []);
  const letSleep = useCallback(() => {
    lock.current?.release().catch(() => {});
    lock.current = null;
  }, []);

  // Screenshots only: a short length without waiting 90 s.
  useEffect(() => {
    (window as unknown as { mtaRestPreview?: (s: number) => void }).mtaRestPreview = (s) => setLength(s);
  }, []);

  // Tick while running, and catch up when the app comes back from the background.
  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => setNow(Date.now());
    const id = window.setInterval(tick, TICK_MS);
    const onVisible = () => {
      tick();
      if (document.visibilityState === 'visible') void keepAwake(); // the lock is dropped when hidden
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [endsAt, keepAwake]);

  const left = endsAt === null ? length : remaining(endsAt, now);

  // Time's up: once.
  useEffect(() => {
    if (endsAt === null || left > 0) return;
    setEndsAt(null);
    setOver(true);
    letSleep();
    if (document.visibilityState === 'visible') {
      navigator.vibrate?.([200, 100, 200]);
      beep(audio.current);
    }
  }, [endsAt, left, letSleep]);

  useEffect(() => {
    if (!over) return;
    const t = window.setTimeout(() => setOver(false), OVER_MS);
    return () => window.clearTimeout(t);
  }, [over]);

  // Leaving the log screen stops the timer and lets the screen sleep.
  useEffect(
    () => () => {
      letSleep();
      void audio.current?.close().catch(() => {});
    },
    [letSleep],
  );

  const start = () => {
    try {
      if (!audio.current) {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        audio.current = Ctx ? new Ctx() : null;
      }
      void audio.current?.resume();
    } catch {
      audio.current = null;
    }
    setOver(false);
    setNow(Date.now());
    setEndsAt(Date.now() + length * 1000);
    void keepAwake();
  };
  const stop = () => {
    setEndsAt(null);
    letSleep();
  };

  const presets: number[] = [...REST_PRESETS];
  if (planRest && !presets.includes(planRest)) presets.push(planRest);
  presets.sort((a, b) => a - b);

  if (endsAt !== null) {
    return (
      <div className="rest-bar" role="timer" aria-live="off">
        <span className="rest-clock">
          Rest <strong>{clock(left)}</strong>
        </span>
        <button className="btn" onClick={() => setEndsAt((e) => (e === null ? e : e + 30_000))}>
          +30 s
        </button>
        <button className="btn" onClick={stop}>
          Stop
        </button>
      </div>
    );
  }

  return (
    <div className="rest-bar">
      {over ? (
        <span className="rest-clock rest-clock--over" role="status">
          Rest over
        </span>
      ) : (
        <Segmented
          label="Rest length"
          options={presets.map((s) => ({ value: s, label: clock(s), ariaLabel: `Rest ${clock(s)}` }))}
          value={length}
          onChange={(v) => {
            if (!v) return;
            setLength(v);
            setRestSeconds(v);
          }}
        />
      )}
      <button className="btn" onClick={start} aria-label={`Start rest, ${clock(length)}`}>
        {over ? 'Again' : 'Start'}
      </button>
    </div>
  );
}
