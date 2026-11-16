import { createContext, useContext } from 'react';
import type { Day, SessionType } from './schema';

/** The session a log screen is for. `date` is the day it's for, not the day it's entered. */
export interface LogTarget {
  date: string;
  week: number;
  day: Day;
  type: SessionType;
}

export interface LogActions {
  openLog(target: LogTarget): void;
}

export const LogActionsContext = createContext<LogActions>({ openLog: () => {} });

export function useLogActions(): LogActions {
  return useContext(LogActionsContext);
}
