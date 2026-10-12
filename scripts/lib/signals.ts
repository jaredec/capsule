import fs from "node:fs";
import path from "node:path";
import { addDays, archiveDateOf, todayPacific } from "../../src/lib/dates";
import { fetchPulseHeadlines, type Headline } from "./sources/googleNews";
import { fetchTrendingSearches, type TrendingSearch } from "./sources/googleTrends";
import { fetchWikipediaPulse, type WikiArticle } from "./sources/wikipedia";

export type Signals = {
  date: string;
  gatheredAt: string;
  headlines: Headline[];
  wikipedia: WikiArticle[];
  trendingSearches: TrendingSearch[];
};

// Snapshots are committed: they make picks reproducible and are the raw material for
// evaluating or fine-tuning a picker later.
export const SIGNALS_DIR = path.join(process.cwd(), "data", "signals");

export function readSignals(date: string): Signals | null {
  const file = path.join(SIGNALS_DIR, `${date}.json`);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as Signals) : null;
}

export function writeSignals(signals: Signals) {
  fs.mkdirSync(SIGNALS_DIR, { recursive: true });
  fs.writeFileSync(path.join(SIGNALS_DIR, `${signals.date}.json`), `${JSON.stringify(signals)}\n`);
}

export async function gatherSignals(date: string): Promise<Signals> {
  const [headlines, wikipedia] = await Promise.all([fetchPulseHeadlines(date), fetchWikipediaPulse(date)]);
  // The trends feed only covers the last day or so; attaching it to older dates would be wrong.
  const live = date >= addDays(todayPacific(), -1);
  const trendingSearches = live
    ? (await fetchTrendingSearches()).filter((t) => archiveDateOf(t.startedAt) === date)
    : [];
  return { date, gatheredAt: new Date().toISOString(), headlines, wikipedia, trendingSearches };
}
