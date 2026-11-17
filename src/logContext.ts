import { createContext, useContext } from 'react';
import type { Day, SessionType } from './schema';
import type { TestType } from './logSchema';

/** The session a log screen is for. `date` is the day it's for, not the day it's entered. */
export interface LogTarget {
  date: string;
  week: number;
  day: Day;
  type: SessionType;
}

/** What the test result form is for: new results (from the Tests tab or a test session), or one to edit. */
export interface TestFormTarget {
  /** Sections shown, e.g. ['drift', 'vertical'] for the week 1 test session. */
  types: TestType[];
  date: string;
  /** From a test session: saving also logs it as done (if not logged yet). */
  session?: LogTarget;
  /** Edit this result. */
  editId?: string;
}

/** The trip form: a new trip on a date (fixed when opened from a hike card), or one to edit. */
export interface TripFormTarget {
  date: string;
  editId?: string;
  fixedDate?: boolean;
}

export interface LogActions {
  openLog(target: LogTarget): void;
  /** Short success Flash at the top of the screen. */
  notify(text: string): void;
  /** Switch to the More tab, optionally scrolled to a box (its element id). */
  openMore(section?: 'backup' | 'settings' | 'cycles'): void;
  openTestForm(target: TestFormTarget): void;
  openTests(): void;
  openTripForm(target: TripFormTarget): void;
  /** The plan editor for a training cycle (full screen). */
  openCycle(id: string): void;
}

export const LogActionsContext = createContext<LogActions>({
  openLog: () => {},
  notify: () => {},
  openMore: () => {},
  openTestForm: () => {},
  openTests: () => {},
  openTripForm: () => {},
  openCycle: () => {},
});

export function useLogActions(): LogActions {
  return useContext(LogActionsContext);
}
