/**
 * Capture the day's top memes into data/days/<date>.json using Grok.
 *
 *   npm run collect                                    # yesterday + today (UTC), refreshing automated entries
 *   npm run collect -- --date 2026-10-05               # one day
 *   npm run collect -- --from 2026-01-01 --to 2026-09-30   # backfill a range (skips days already captured)
 *
 * Options:
 *   --platform x[,tiktok,...]  platforms to collect (default: x)
 *   --count 3                  items to keep per platform per day
 *   --refresh                  re-run days that already have automated items for the platform
 *   --force                    also replace hand-curated items
 *   --dry-run                  print results without writing files
 *
 * Requires XAI_API_KEY. Override the model with XAI_MODEL.
 */
import { parseArgs } from "node:util";
import { addDays, isValidIsoDate, todayUtc } from "../src/lib/dates";
import { PLATFORMS, itemSchema, type Item, type Platform } from "../src/lib/schema";
import { askGrok, type Candidate } from "./lib/grok";
import { decideMerge, readDay, replacePlatform, writeDay } from "./lib/store";
import { isHttpUrl, verifyPostUrl } from "./lib/verify";

const { values } = parseArgs({
  options: {
    date: { type: "string" },
    from: { type: "string" },
    to: { type: "string" },
    platform: { type: "string", default: "x" },
    count: { type: "string", default: "3" },
    refresh: { type: "boolean", default: false },
    force: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
});

function fail(message: string): never {
  console.error(`error: ${message}`);
  process.exit(1);
}

function resolveDates(): { dates: string[]; refresh: boolean } {
  const today = todayUtc();
  if (values.date) {
    const date = values.date === "today" ? today : values.date === "yesterday" ? addDays(today, -1) : values.date;
    if (!isValidIsoDate(date)) fail(`invalid --date ${values.date}`);
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
  // Default daily run: finalize yesterday and keep a live pick for today.
  return { dates: [addDays(today, -1), today], refresh: true };
}

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "item"
  );
}

async function toItem(
  platform: Platform,
  date: string,
  candidate: Candidate,
  rank: number,
  citations: Set<string>,
): Promise<Item | null> {
  const verification = await verifyPostUrl(platform, candidate.sourceUrl, citations);
  if (candidate.sourceUrl && !verification.url) {
    console.warn(`  dropped sourceUrl for "${candidate.title}": ${verification.reason}`);
  }
  const references = candidate.references.filter((r) => isHttpUrl(r.url)).slice(0, 3);
  // Without a verified post or any supporting link there's nothing to show the reader.
  if (!verification.url && references.length === 0) {
    console.warn(`  skipped "${candidate.title}": no verifiable source`);
    return null;
  }

  const metrics = Object.fromEntries(
    Object.entries(candidate.metrics).filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
  const urlHandle = platform === "x" && verification.url ? new URL(verification.url).pathname.split("/")[1] : null;
  const handle = urlHandle ?? candidate.author?.trim();

  const item = {
    id: `${date}-${platform}-${slugify(candidate.title)}`,
    platform,
    rank,
    title: candidate.title.trim(),
    summary: candidate.summary.trim(),
    kind: candidate.kind,
    tags: candidate.tags.map((t) => slugify(t)).filter(Boolean).slice(0, 4),
    author: handle ? (handle.startsWith("@") ? handle : `@${handle}`) : null,
    sourceUrl: verification.url,
    ...(Object.keys(metrics).length > 0 ? { metrics } : {}),
    references,
    collectedBy: platform === "x" ? "grok-x-search" : "grok-web-search",
    collectedAt: new Date().toISOString(),
  };
  const parsed = itemSchema.safeParse(item);
  if (!parsed.success) {
    console.warn(`  skipped "${candidate.title}": ${parsed.error.message}`);
    return null;
  }
  return parsed.data;
}

async function main() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) fail("XAI_API_KEY is not set");
  const model = process.env.XAI_MODEL || "grok-4.7";

  const platforms = values.platform.split(",").map((p) => p.trim()) as Platform[];
  for (const p of platforms) if (!PLATFORMS.includes(p)) fail(`unknown platform "${p}"`);
  const count = Math.max(1, Math.min(5, Number(values.count) || 3));
  const { dates, refresh } = resolveDates();
  const dryRun = values["dry-run"];

  let wrote = 0;
  let failed = 0;
  for (const date of dates) {
    for (const platform of platforms) {
      const day = readDay(date);
      const decision = decideMerge(day, platform, { refresh, force: values.force });
      if (decision !== "write") {
        console.log(`${date} ${platform}: ${decision}`);
        continue;
      }

      console.log(`${date} ${platform}: asking ${model}…`);
      try {
        const result = await askGrok({ platform, date, nextDate: addDays(date, 1), count, apiKey, model });
        const items: Item[] = [];
        for (const candidate of result.candidates.slice(0, count)) {
          const item = await toItem(platform, date, candidate, items.length + 1, result.citations);
          if (item) items.push(item);
        }
        if (items.length === 0) {
          console.warn(`${date} ${platform}: no usable items, leaving file untouched`);
          continue;
        }
        for (const item of items) console.log(`  #${item.rank} ${item.title}${item.sourceUrl ? ` (${item.sourceUrl})` : ""}`);
        if (!dryRun) {
          writeDay(replacePlatform(day, platform, items));
          wrote++;
        }
      } catch (err) {
        failed++;
        console.error(`${date} ${platform}: failed — ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  console.log(`\nDone. ${wrote} day/platform files written, ${failed} failures.`);
  if (failed > 0 && wrote === 0) process.exit(1);
}

main();
