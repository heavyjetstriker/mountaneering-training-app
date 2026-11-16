// Rest timer maths. Pure functions only; the timer screen does the ticking.

/** Lengths to pick from. The plan gives no gym rest times, so none is "the plan's". */
export const REST_PRESETS = [60, 90, 120, 180] as const;
export const DEFAULT_REST = 90;

/** A rest length written in the plan: "2 min rest" → 120, "90 s rest" → 90. */
export function restFromPlan(text: string): number | null {
  const m = /(\d+(?:\.\d+)?)\s*(min|s)\s+rest\b/i.exec(text);
  if (!m) return null;
  const n = Number(m[1]);
  return Math.round(m[2].toLowerCase() === 'min' ? n * 60 : n);
}

/** Whole seconds left until `endsAt` (ms), never below 0. Rounds up so 0:01 shows until the end. */
export function remaining(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** 90 → "1:30", 5 → "0:05". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
