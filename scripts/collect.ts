/**
 * Captures each day's internet "pulse" into data/days/<date>.json.
 *
 * Pipeline (all free except one small LLM call per day):
 *   1. gather  - Google News coverage of viral/meme moments, Wikipedia breakout pages,
 *                Google trending searches -> data/signals/<date>.json
 *   2. pick    - a cheap LLM clusters the headlines and scores reach / feed dominance /
 *                memeability, penalizing sports/tech/politics unless they crossed over
 *   3. enrich  - resolve article URLs, pull embedded X/TikTok posts from them, and read
 *                like/reply counts from X's public embed endpoint (no X API credits)
 *
 *   npm run collect                                   # the last two complete days (Pacific time)
 *   npm run collect -- --date 2026-10-05
 *   npm run collect -- --from 2026-01-01 --to 2026-09-30
 *   npm run collect -- --date 2026-10-05 --gather-only   # signals only, no LLM needed
 *
 * Options: --count 3, --refresh (redo automated days), --force (also replace curated days),
 *          --regather (refetch signals even if cached), --dry-run
 *
 * LLM: set GEMINI_API_KEY, XAI_API_KEY or OPENAI_API_KEY (see scripts/lib/llm.ts).
 */
import { parseArgs } from "node:util";
import { addDays, isValidIsoDate, todayPacific } from "../src/lib/dates";
import { buildItems } from "./lib/build";
import { resolveLlm } from "./lib/llm";
import { pickStories } from "./lib/pick";
import { readPicks } from "./lib/picks";
import { gatherSignals, readSignals, writeSignals } from "./lib/signals";
import { decideMerge, readDay, writeDay } from "./lib/store";

const { values } = parseArgs({
  options: {
    date: { type: "string" },
    from: { type: "string" },
    to: { type: "string" },
    count: { type: "string", default: "3" },
    refresh: { type: "boolean", default: false },
    force: { type: "boolean", default: false },
    regather: { type: "boolean", default: false },
    "gather-only": { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
});

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function resolveDates(): { dates: string[]; refresh: boolean } {
  const today = todayPacific();
  if (values.date) {
    const date = values.date === "today" ? today : values.date === "yesterday" ? addDays(today, -1) : values.date;
    if (!isValidIsoDate(date)) fail(`invalid --date ${values.date}`);
    if (date > today) fail(`--date ${date} is in the future`);
    return { dates: [date], refresh: values.refresh };
  }
  if (values.from || values.to) {
    if (!values.from || !values.to) fail("--from and --to must be used together");
    if (!isValidIsoDate(values.from) || !isValidIsoDate(values.to)) fail("--from/--to must be YYYY-MM-DD");
    if (values.from > values.to) fail("--from must be on or before --to");
    const dates: string[] = [];
    for (let d = values.from; d <= values.to && d <= today; d = addDays(d, 1)) dates.push(d);
    return { dates, refresh: values.refresh };
  }
  // Coverage of a viral moment trails it by up to a day, so the default run settles the
  // last two complete days instead of guessing at today.
  return { dates: [addDays(today, -2), addDays(today, -1)], refresh: true };
}

function recentTitles(date: string): string[] {
  const titles: string[] = [];
  for (let i = 1; i <= 3; i++) titles.push(...readDay(addDays(date, -i)).items.map((item) => item.title));
  return titles;
}

async function main() {
  const { dates, refresh } = resolveDates();
  const gatherOnly = values["gather-only"];
  const dryRun = values["dry-run"];
  const count = Math.max(1, Math.min(5, Number(values.count) || 3));
  const llm = gatherOnly ? null : resolveLlm();
  if (!gatherOnly && !llm) fail("no LLM configured: set GEMINI_API_KEY, XAI_API_KEY or OPENAI_API_KEY (or use --gather-only)");

  let wrote = 0;
  let failed = 0;
  for (const date of dates) {
    const day = readDay(date);
    const decision = gatherOnly
      ? "write"
      : decideMerge(day, { refresh, force: values.force, hasPicks: readPicks(date) !== null });
    if (decision !== "write") {
      console.log(`${date}: ${decision}`);
      continue;
    }

    try {
      let signals = values.regather ? null : readSignals(date);
      if (!signals) {
        signals = await gatherSignals(date);
        if (!dryRun) writeSignals(signals);
      }
      console.log(`${date}: ${signals.headlines.length} headlines, ${signals.wikipedia.length} wiki pages`);
      if (gatherOnly || !llm) continue;

      const { stories, reserves, usage } = await pickStories(llm, signals, { count, recentTitles: recentTitles(date) });
      console.log(`  picked ${stories.length} with ${llm.label} usage=${JSON.stringify(usage)}`);
      const collectedBy = `pulse:${llm.model}`;
      let items = await buildItems(signals, stories, collectedBy);
      for (const reserve of reserves) {
        if (items.length > 0) break;
        console.log(`  no usable picks, trying reserve "${reserve.title}"`);
        items = await buildItems(signals, [reserve], collectedBy);
      }
      // Every day must show something; keep whatever the day already had and flag it.
      if (items.length === 0) throw new Error("no candidate had a usable source");
      if (!dryRun) {
        writeDay({ date, items });
        wrote++;
      }
    } catch (err) {
      failed++;
      console.error(`${date}: failed — ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\nDone. ${wrote} days written, ${failed} failures.`);
  if (failed > 0 && wrote === 0) process.exit(1);
}

main();
