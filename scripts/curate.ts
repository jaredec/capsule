/**
 * Editor override: you choose the day's stories, the pipeline does the legwork
 * (article links, same-day posts, engagement numbers). Curated days are never
 * overwritten by the collector, and they double as labeled examples for tuning the picker.
 *
 *   npm run curate -- picks/2026-10-07.json
 *
 * The file holds { "date": "YYYY-MM-DD", "stories": [...] }, where each story has the
 * same fields the LLM picker returns (see Story in scripts/lib/pick.ts); headlineIds refer
 * to data/signals/<date>.json, which is gathered first if missing. An optional "sourceUrl"
 * pins a specific X post to feature, "imageUrl" swaps in a better still than the post's own
 * media (say, a photo instead of a screenshot of text), and "crop" ({ x, y, w, h } as fractions
 * of the image) picks the part of the image the calendar shows instead of the automatic crop.
 */
import fs from "node:fs";
import { isValidIsoDate } from "../src/lib/dates";
import type { Crop } from "../src/lib/schema";
import { buildItems } from "./lib/build";
import { scoreStory, type Story } from "./lib/pick";
import { gatherSignals, readSignals, writeSignals } from "./lib/signals";
import { writeDay } from "./lib/store";

type PickFile = { date: string; stories: (Omit<Story, "peakDay" | "why"> & { sourceUrl?: string; imageUrl?: string; crop?: Crop })[] };

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("usage: npm run curate -- <picks.json> [...]");
    process.exit(1);
  }
  for (const file of files) {
    const picks = JSON.parse(fs.readFileSync(file, "utf8")) as PickFile;
    if (!isValidIsoDate(picks.date)) throw new Error(`${file}: invalid date`);
    let signals = readSignals(picks.date);
    if (!signals) {
      signals = await gatherSignals(picks.date);
      writeSignals(signals);
    }
    console.log(`${picks.date}: ${picks.stories.length} curated stories`);
    const stories = picks.stories.map((s) => ({
      ...s,
      peakDay: "target" as const,
      why: "",
      pulse: {
        score: scoreStory(s),
        reach: s.reach,
        dominance: s.dominance,
        memeability: s.memeability,
        category: s.category,
        crossover: s.crossover,
      },
    }));
    const items = await buildItems(signals, stories, "editor");
    writeDay({ date: picks.date, items });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
