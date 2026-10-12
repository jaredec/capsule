import fs from "node:fs";
import path from "node:path";
import { dayFileSchema, type DayFile, type Item } from "../../src/lib/schema";

export const DAYS_DIR = path.join(process.cwd(), "data", "days");

/** Items written by the collector; anything else (editor, web-research) counts as curated. */
export const isAutomated = (item: Item) => item.collectedBy.startsWith("pulse:");

export function readDay(date: string): DayFile {
  const file = path.join(DAYS_DIR, `${date}.json`);
  if (!fs.existsSync(file)) return { date, items: [] };
  return dayFileSchema.parse(JSON.parse(fs.readFileSync(file, "utf8")));
}

export function writeDay(day: DayFile) {
  fs.mkdirSync(DAYS_DIR, { recursive: true });
  const items = day.items.map((item, i) => ({ ...item, rank: i + 1 }));
  const file = path.join(DAYS_DIR, `${day.date}.json`);
  fs.writeFileSync(file, `${JSON.stringify({ date: day.date, items }, null, 2)}\n`);
}

export type MergeDecision = "write" | "skip-curated" | "skip-existing";

export function decideMerge(day: DayFile, opts: { refresh: boolean; force: boolean }): MergeDecision {
  if (day.items.length === 0 || opts.force) return "write";
  if (day.items.some((i) => !isAutomated(i))) return "skip-curated";
  return opts.refresh ? "write" : "skip-existing";
}
