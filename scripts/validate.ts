/** Validates every file in data/days against the shared schema. Used in CI. */
import fs from "node:fs";
import path from "node:path";
import { isValidIsoDate } from "../src/lib/dates";
import { dayFileSchema } from "../src/lib/schema";
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
  if (day.items.length > 0 && day.items.filter((i) => i.rank === 1).length !== 1) {
    report("exactly one item must have rank 1");
  }
}

console.log(`Checked ${files.length} day files, ${errors} problems.`);
process.exit(errors > 0 ? 1 : 0);
