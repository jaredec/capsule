/**
 * Validates every file in data/days against the shared schema, and that the archive has no
 * empty days: every date from the first day file to the last features exactly one item, and every
 * picks file lists at least one story. Used in CI.
 */
import fs from "node:fs";
import path from "node:path";
import { addDays, isValidIsoDate } from "../src/lib/dates";
import { dayFileSchema } from "../src/lib/schema";
import { PICKS_DIR } from "./lib/picks";
import { DAYS_DIR } from "./lib/store";

let errors = 0;
const files = fs.existsSync(DAYS_DIR) ? fs.readdirSync(DAYS_DIR).filter((f) => f.endsWith(".json")) : [];

for (const file of files) {
  const report = (msg: string) => {
    errors++;
    console.error(`${file}: ${msg}`);
  };
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(path.join(DAYS_DIR, file), "utf8"));
  } catch (err) {
    report(`invalid JSON (${(err as Error).message})`);
    continue;
  }
  const parsed = dayFileSchema.safeParse(raw);
  if (!parsed.success) {
    report(parsed.error.message);
    continue;
  }
  const day = parsed.data;
  if (`${day.date}.json` !== file) report(`date field ${day.date} does not match filename`);
  if (!isValidIsoDate(day.date)) report(`invalid calendar date ${day.date}`);
  const ids = new Set<string>();
  for (const item of day.items) {
    if (ids.has(item.id)) report(`duplicate item id ${item.id}`);
    ids.add(item.id);
    if (!item.id.startsWith(day.date)) report(`item id ${item.id} should start with ${day.date}`);
  }
  if (day.items.length === 0) report("day has no items");
  else if (day.items.length > 1) report(`day has ${day.items.length} items, it should feature exactly one`);
  else if (day.items[0].rank !== 1) report("the item must have rank 1");
}

const dates = files.map((f) => f.replace(/\.json$/, "")).filter(isValidIsoDate).sort();
const archived = new Set(dates);
if (dates.length > 0) {
  for (let d = dates[0]; d < dates[dates.length - 1]; d = addDays(d, 1)) {
    if (!archived.has(d)) {
      errors++;
      console.error(`${d}.json: missing, every day between the first and last archived day needs a pick`);
    }
  }
}

const pickFiles = fs.existsSync(PICKS_DIR) ? fs.readdirSync(PICKS_DIR).filter((f) => f.endsWith(".json")) : [];
for (const file of pickFiles) {
  const picks = JSON.parse(fs.readFileSync(path.join(PICKS_DIR, file), "utf8")) as { stories?: unknown[] };
  if (!picks.stories?.length) {
    errors++;
    console.error(`picks/${file}: lists no stories, every day needs at least one`);
  }
  if (!archived.has(file.replace(/\.json$/, ""))) {
    errors++;
    console.error(`picks/${file}: no matching day file, run npm run curate on it`);
  }
}

console.log(`Checked ${files.length} day files, ${errors} problems.`);
process.exit(errors > 0 ? 1 : 0);
