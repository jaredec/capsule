import fs from "node:fs";
import path from "node:path";
import { PLATFORMS, dayFileSchema, type DayFile, type Item, type Platform } from "../../src/lib/schema";

export const DAYS_DIR = path.join(process.cwd(), "data", "days");

export const isAutomated = (item: Item) => item.collectedBy.startsWith("grok");

export function readDay(date: string): DayFile {
  const file = path.join(DAYS_DIR, `${date}.json`);
  if (!fs.existsSync(file)) return { date, items: [] };
  return dayFileSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
}

export function writeDay(day: DayFile) {
  fs.mkdirSync(DAYS_DIR, { recursive: true });
  const ranked = rerank(day.items);
  const file = path.join(DAYS_DIR, `${day.date}.json`);
  fs.writeFileSync(file, `${JSON.stringify({ date: day.date, items: ranked }, null, 2)}\n`);
}

/** The day's headline is the top X item, then other platforms in PLATFORMS order. */
function rerank(items: Item[]): Item[] {
  return [...items]
    .sort((a, b) => PLATFORMS.indexOf(a.platform) - PLATFORMS.indexOf(b.platform) || a.rank - b.rank)
    .map((item, i) => ({ ...item, rank: i + 1 }));
}

export type MergeDecision = "write" | "skip-curated" | "skip-existing";

export function decideMerge(day: DayFile, platform: Platform, opts: { refresh: boolean; force: boolean }): MergeDecision {
  const existing = day.items.filter((i) => i.platform === platform);
  if (existing.length === 0 || opts.force) return "write";
  if (existing.some((i) => !isAutomated(i))) return "skip-curated";
  return opts.refresh ? "write" : "skip-existing";
}

export function replacePlatform(day: DayFile, platform: Platform, items: Item[]): DayFile {
  return { date: day.date, items: [...day.items.filter((i) => i.platform !== platform), ...items] };
}
