import { decodeEntities, fetchText } from "../http";

export type TrendingSearch = { query: string; traffic: string; startedAt: string };

/** Google's daily trending searches (US). Only covers roughly the last 24h, so it's used for live days. */
export async function fetchTrendingSearches(): Promise<TrendingSearch[]> {
  const xml = await fetchText("https://trends.google.com/trending/rss?geo=US");
  if (!xml) return [];
  const out: TrendingSearch[] = [];
  for (const [, body] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const query = decodeEntities(body.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const traffic = body.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/)?.[1] ?? "";
    const pubDate = body.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
    if (query && pubDate) out.push({ query, traffic, startedAt: new Date(pubDate).toISOString() });
  }
  return out;
}
