/**
 * Adds a still image to archived items that don't have one yet.
 *
 *   npm run images                 # every day file
 *   npm run images -- 2026-10-07   # specific days
 *   npm run images -- --redo       # replace existing images too
 */
import fs from "node:fs";
import { attachImage } from "./lib/media";
import { DAYS_DIR, readDay, writeDay } from "./lib/store";

async function main() {
  const args = process.argv.slice(2);
  const redo = args.includes("--redo");
  const requested = args.filter((a) => !a.startsWith("--"));
  const dates = requested.length > 0
    ? requested
    : fs.readdirSync(DAYS_DIR).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", "")).sort();

  for (const date of dates) {
    const day = readDay(date);
    let changed = false;
    const items = [];
    for (const item of day.items) {
      if (item.image && !redo) {
        items.push(item);
        continue;
      }
      const withImage = await attachImage(date, item);
      changed ||= withImage !== item;
      items.push(withImage);
    }
    if (changed) writeDay({ date, items });
    console.log(`${date}: ${items.filter((i) => i.image).length}/${items.length} items have images`);
  }
}

main();
