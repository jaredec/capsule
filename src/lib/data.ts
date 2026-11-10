import fs from "node:fs";
import path from "node:path";
import { compareYearMonth, parseIsoDate, type YearMonth } from "./dates";
import { PLATFORMS, dayFileSchema, type DayFile, type Item, type Platform } from "./schema";

const DAYS_DIR = path.join(process.cwd(), "data", "days");

let cache: Map<string, DayFile> | null = null;

// Synchronous reads keep these values "predictable" for Cache Components, so pages
// built from them are fully prerendered at build time.
function loadAll(): Map<string, DayFile> {
  if (cache && process.env.NODE_ENV === "production") return cache;
  const days = new Map<string, DayFile>();
  if (!fs.existsSync(DAYS_DIR)) return days;
  for (const file of fs.readdirSync(DAYS_DIR).sort()) {
    if (!file.endsWith(".json")) continue;
    const raw = JSON.parse(fs.readFileSync(path.join(DAYS_DIR, file), "utf8"));
    const parsed = dayFileSchema.parse(raw);
    parsed.items.sort((a, b) => a.rank - b.rank);
    days.set(parsed.date, parsed);
  }
  cache = days;
  return days;
}

export function getDay(date: string): DayFile | undefined {
  return loadAll().get(date);
}

export function getAllDates(): string[] {
  return [...loadAll().keys()];
}

export function getDatesWithItems(): string[] {
  return [...loadAll().values()].filter((d) => d.items.length > 0).map((d) => d.date);
}

/** Items for each of the given days that has any. */
export function getItemsForDates(dates: string[]): Record<string, Item[]> {
  const all = loadAll();
  const result: Record<string, Item[]> = {};
  for (const date of dates) {
    const day = all.get(date);
    if (day && day.items.length > 0) result[date] = day.items;
  }
  return result;
}

export function getPlatformsWithData(): Platform[] {
  const found = new Set<Platform>();
  for (const day of loadAll().values()) for (const item of day.items) found.add(item.platform);
  return PLATFORMS.filter((p) => found.has(p));
}

/** Every month from the earliest archived month through the latest, inclusive. */
export function getArchivedMonths(): YearMonth[] {
  const dates = getAllDates();
  if (dates.length === 0) return [];
  const first = parseIsoDate(dates[0]);
  const last = parseIsoDate(dates[dates.length - 1]);
  const months: YearMonth[] = [];
  let cursor: YearMonth = { year: first.year, month: first.month };
  const end: YearMonth = { year: last.year, month: last.month };
  while (compareYearMonth(cursor, end) <= 0) {
    months.push(cursor);
    cursor = cursor.month === 12 ? { year: cursor.year + 1, month: 1 } : { ...cursor, month: cursor.month + 1 };
  }
  return months;
}

export function getLatestMonth(): YearMonth | undefined {
  return getArchivedMonths().at(-1);
}
