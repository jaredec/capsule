/**
 * Fills in images and X post snapshots for archived items.
 *
 *   npm run media                  # every day file
 *   npm run media -- 2026-10-07    # specific days
 *   npm run media -- --redo        # replace existing images too
 */
import fs from "node:fs";
import { attachMedia } from "./lib/media";
import { DAYS_DIR, readDay, writeDay } from "./lib/store";

async function main() {
  const args = process.argv.slice(2);
  const redoImage = args.includes("--redo");
  const requested = args.filter((a) => !a.startsWith("--"));
  const dates = requested.length > 0
    ? requested
    : fs.readdirSync(DAYS_DIR).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", "")).sort();

  for (const date of dates) {
    const day = readDay(date);
    const items = [];
    for (const item of day.items) items.push(await attachMedia(date, item, { redoImage }));
    writeDay({ date, items });
    const posts = items.filter((i) => i.post).length;
    const images = items.filter((i) => i.image).length;
    console.log(`${date}: ${images}/${items.length} images, ${posts}/${items.length} posts`);
  }
}

main();
