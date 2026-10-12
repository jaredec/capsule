// A Capsule day is a calendar day in US Pacific time (the day ends at midnight PT),
// represented as "YYYY-MM-DD". Helpers below do pure date arithmetic in UTC on those strings.

export const ARCHIVE_TIME_ZONE = "America/Los_Angeles";

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type YearMonth = { year: number; month: number }; // month is 1-12

const pad = (n: number) => String(n).padStart(2, "0");

export function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseIsoDate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

export function isValidIsoDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const { year, month, day } = parseIsoDate(iso);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** 0 = Sunday */
export function weekdayOf(year: number, month: number, day: number): number {
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function addDays(iso: string, delta: number): string {
  const { year, month, day } = parseIsoDate(iso);
  const d = new Date(Date.UTC(year, month - 1, day + delta));
  return toIsoDate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

export function monthKey({ year, month }: YearMonth): string {
  return `${year}-${pad(month)}`;
}

export function monthPath({ year, month }: YearMonth): string {
  return `/${year}/${pad(month)}`;
}

export function formatLongDate(iso: string): string {
  const { year, month, day } = parseIsoDate(iso);
  const weekday = new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
  return `${weekday}, ${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

/** Leading nulls pad the first week so day 1 lands on its weekday column. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const cells: (string | null)[] = Array(weekdayOf(year, month, 1)).fill(null);
  for (let day = 1; day <= daysInMonth(year, month); day++) {
    cells.push(toIsoDate(year, month, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const pacificFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ARCHIVE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Capsule day a moment in time belongs to. */
export function archiveDateOf(instant: Date | string): string {
  return pacificFormatter.format(typeof instant === "string" ? new Date(instant) : instant);
}

export function todayPacific(now: Date = new Date()): string {
  return archiveDateOf(now);
}
