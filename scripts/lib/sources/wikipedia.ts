import { addDays, parseIsoDate } from "../../../src/lib/dates";
import { fetchText } from "../http";

export type WikiArticle = { title: string; views: number; breakout: boolean };

const SKIP = /^(Main_Page|Special:|Wikipedia:|Portal:|File:|Help:|Talk:|Template:|Category:|User:|Deaths_in_)/;

async function topArticles(date: string): Promise<{ article: string; views: number }[]> {
  const { year, month, day } = parseIsoDate(date);
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/en.wikipedia/all-access/${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
  const text = await fetchText(url, { headers: { "User-Agent": "capsule/0.1 (https://github.com/jaredec/capsule)" } });
  if (!text) return [];
  const json = JSON.parse(text) as { items?: { articles: { article: string; views: number }[] }[] };
  return (json.items?.[0]?.articles ?? []).filter((a) => !SKIP.test(a.article));
}

/**
 * Most-read English Wikipedia pages for the day. `breakout` marks pages that weren't in the
 * top 1000 on any of the previous three days: a free proxy for "normies suddenly looked this up".
 */
export async function fetchWikipediaPulse(date: string, limit = 60): Promise<WikiArticle[]> {
  const today = await topArticles(date);
  const previous = new Set<string>();
  for (let i = 1; i <= 3; i++) for (const a of await topArticles(addDays(date, -i))) previous.add(a.article);
  return today.slice(0, limit).map((a) => ({
    title: a.article.replace(/_/g, " "),
    views: a.views,
    breakout: !previous.has(a.article),
  }));
}
