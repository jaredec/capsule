import { addDays } from "../../../src/lib/dates";
import { decodeEntities, fetchText, sleep } from "../http";

export type Headline = {
  id: number;
  title: string;
  source: string;
  publishedAt: string;
  /** Google News article id; resolve with resolveGoogleNewsUrl(). */
  gnId: string;
};

// Queries aimed at "what was everyone talking about" coverage rather than hard news.
export const PULSE_QUERIES = [
  '"went viral"',
  "meme OR memes",
  '"the internet" (reacts OR obsessed OR divided OR losing)',
  '"social media" (reacts OR erupts OR "can\'t stop" OR frenzy)',
  '"viral video" OR "viral clip"',
  'TikTok (trend OR viral)',
  '"on X" (viral OR reacts OR fans)',
];

const JUNK_SOURCES = /^(YouTube|Binance|Bybit|Coinbase|CoinMarketCap|TradingView|CryptoTicker|AMBCrypto|Coinspeaker|TechBullion|StreetInsider|LiteFinance|TradingKey|markets\.businessinsider\.com)$/i;
const JUNK_TITLES = [
  /meme ?coin|memecoin|crypto|token|\bprice (today|prediction)|\bconvert \d|market ?cap|dogecoin|shiba/i,
  // Evergreen listicles ("25 Coffee Memes That...") say nothing about the day.
  /^\d{1,3} .*\b(memes|tweets|posts|photos|pics)\b/i,
  /\bbest memes\b|\bfunniest memes\b/i,
];

function isJunk(title: string, source: string): boolean {
  return JUNK_SOURCES.test(source) || JUNK_TITLES.some((re) => re.test(title));
}

function parseItems(xml: string): Omit<Headline, "id">[] {
  const items: Omit<Headline, "id">[] = [];
  for (const [, body] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const rawTitle = decodeEntities(body.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "");
    const source = decodeEntities(body.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? "");
    const gnId = body.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1]?.trim() ?? "";
    const pubDate = body.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1];
    if (!rawTitle || !gnId || !pubDate) continue;
    const title = rawTitle.replace(/ - [^-]{2,60}$/, "");
    if (isJunk(title, source)) continue;
    items.push({ title, source, gnId, publishedAt: new Date(pubDate).toISOString() });
  }
  return items;
}

/**
 * Headlines published on `date` or the day after (write-ups of a viral moment usually
 * trail it by a day). Free, and works for any past date, which is what makes backfill cheap.
 */
export async function fetchPulseHeadlines(date: string): Promise<Headline[]> {
  const before = addDays(date, 2);
  const seen = new Set<string>();
  const out: Headline[] = [];
  for (const query of PULSE_QUERIES) {
    const q = encodeURIComponent(`${query} after:${date} before:${before}`);
    const xml = await fetchText(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`);
    if (xml) {
      for (const item of parseItems(xml)) {
        const key = item.title.toLowerCase().replace(/\W+/g, " ").trim();
        if (seen.has(key)) continue;
        if (item.publishedAt.slice(0, 10) < date || item.publishedAt.slice(0, 10) >= before) continue;
        seen.add(key);
        out.push({ id: out.length + 1, ...item });
      }
    }
    await sleep(600);
  }
  return out;
}

/** Google News RSS links are opaque redirects; this asks Google for the publisher URL. */
export async function resolveGoogleNewsUrl(gnId: string): Promise<string | null> {
  const page = await fetchText(`https://news.google.com/rss/articles/${gnId}`);
  const signature = page?.match(/data-n-a-sg="([^"]+)"/)?.[1];
  const timestamp = page?.match(/data-n-a-ts="([^"]+)"/)?.[1];
  if (!signature || !timestamp) return null;

  const inner = JSON.stringify([
    "garturlreq",
    [["X", "X", ["X", "X"], null, null, 1, 1, "US:en", null, 1, null, null, null, null, null, 0, 1], "X", "X", 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0],
    gnId,
    Number(timestamp),
    signature,
  ]);
  const body = new URLSearchParams({ "f.req": JSON.stringify([[["Fbv4je", inner, null, "generic"]]]) });
  const res = await fetchText("https://news.google.com/_/DotsSplashUi/data/batchexecute", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: body.toString(),
  });
  const match = res?.match(/\\"garturlres\\",\\"(https?:[^"\\]+)/);
  return match?.[1] ?? null;
}
