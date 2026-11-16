import { useMemo } from 'react';
import type { Plan } from './schema';
import type { Context } from './plan';
import { contextForWeek } from './tests';
import { useAppData } from './store';

/** The test-results context for laying out a plan week. Every screen uses this one. */
export function useWeekContext(plan: Plan, week: number): Context {
  const { tests, logs } = useAppData();
  return useMemo(() => contextForWeek(plan, { tests, logs }, week), [plan, tests, logs, week]);
}
