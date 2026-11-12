"use client";

import { createContext, use, useMemo, useState } from "react";

export type CalendarView = "week" | "month";

type CalendarState = {
  view: CalendarView;
  setView: (view: CalendarView) => void;
  /** The Sunday starting the week shown, or null for each month's default week. */
  week: string | null;
  setWeek: (week: string | null) => void;
};

const CalendarStateContext = createContext<CalendarState | null>(null);

/**
 * Holds the view and week above the month pages: the router keeps visited months mounted
 * and restores them with their own state, which would bring back a week already left behind.
 */
export function CalendarStateProvider({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<CalendarView>("month");
  const [week, setWeek] = useState<string | null>(null);
  const value = useMemo(() => ({ view, setView, week, setWeek }), [view, week]);
  return <CalendarStateContext value={value}>{children}</CalendarStateContext>;
}

export function useCalendarState(): CalendarState {
  const state = use(CalendarStateContext);
  if (!state) throw new Error("useCalendarState needs a CalendarStateProvider");
  return state;
}
