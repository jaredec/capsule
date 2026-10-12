import { addDays, archiveDateOf } from "../../src/lib/dates";
import type { Platform, Reference } from "../../src/lib/schema";
import { fetchText } from "./http";
import { resolveGoogleNewsUrl, type Headline } from "./sources/googleNews";

export type XPost = {
  url: string;
  handle: string;
  likes: number;
  replies: number;
  createdAt: string;
  /** First photo, or the poster frame of a video. */
  mediaUrl: string | null;
};

export type Enrichment = {
  references: Reference[];
  xPosts: XPost[];
  tiktokUrls: string[];
  instagramUrls: string[];
};

const X_STATUS = /https?:\/\/(?:www\.|mobile\.)?(?:twitter|x)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{8,20})/g;
const TIKTOK = /https?:\/\/(?:www\.)?tiktok\.com\/@([\w.]+)\/video\/(\d+)/g;
const INSTAGRAM = /https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel)\/([\w-]{5,})/g;

// Same token scheme react-tweet uses for X's public embed endpoint.
function syndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
}

/** Public, unauthenticated post lookup (what embedded posts use). Costs nothing. */
export async function lookupXPost(id: string): Promise<XPost | null> {
  const text = await fetchText(
    `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${syndicationToken(id)}`,
    { retries: 1 },
  );
  if (!text) return null;
  try {
    const t = JSON.parse(text) as {
      __typename?: string;
      favorite_count?: number;
      conversation_count?: number;
      created_at?: string;
      user?: { screen_name?: string };
      mediaDetails?: { media_url_https?: string }[];
      photos?: { url?: string }[];
      video?: { poster?: string };
    };
    if (t.__typename === "TweetTombstone" || !t.user?.screen_name || !t.created_at) return null;
    return {
      url: `https://x.com/${t.user.screen_name}/status/${id}`,
      handle: `@${t.user.screen_name}`,
      likes: t.favorite_count ?? 0,
      replies: t.conversation_count ?? 0,
      createdAt: t.created_at,
      mediaUrl: t.photos?.[0]?.url ?? t.video?.poster ?? t.mediaDetails?.[0]?.media_url_https ?? null,
    };
  } catch {
    return null;
  }
}

export function compactNumber(n: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export async function enrichStory(date: string, headlines: Headline[], maxArticles = 3): Promise<Enrichment> {
  const references: Reference[] = [];
  const statusIds = new Map<string, string>();
  const tiktok = new Set<string>();
  const instagram = new Set<string>();

  for (const h of headlines.slice(0, maxArticles + 2)) {
    if (references.length >= maxArticles) break;
    const url = await resolveGoogleNewsUrl(h.gnId);
    if (!url) continue;
    references.push({ title: h.title, url });
    const html = await fetchText(url, { retries: 1, timeoutMs: 15_000 });
    if (!html) continue;
    for (const m of html.matchAll(X_STATUS)) if (m[1].toLowerCase() !== "i") statusIds.set(m[2], m[1]);
    for (const m of html.matchAll(TIKTOK)) tiktok.add(`https://www.tiktok.com/@${m[1]}/video/${m[2]}`);
    for (const m of html.matchAll(INSTAGRAM)) instagram.add(`https://www.instagram.com/p/${m[1]}/`);
  }

  // Posts embedded in coverage of the day; ignore old posts an article happened to cite.
  const windowStart = addDays(date, -1);
  const windowEnd = addDays(date, 1);
  const xPosts: XPost[] = [];
  for (const id of [...statusIds.keys()].slice(0, 15)) {
    const post = await lookupXPost(id);
    if (!post) continue;
    const day = archiveDateOf(post.createdAt);
    if (day >= windowStart && day <= windowEnd) xPosts.push(post);
  }
  xPosts.sort((a, b) => b.likes - a.likes);

  return { references, xPosts, tiktokUrls: [...tiktok], instagramUrls: [...instagram] };
}

/** Picks the post to feature: the most-liked same-day X post, else a TikTok/Instagram embed. */
export function choosePost(
  preferred: Platform,
  e: Enrichment,
): { platform: Platform; url: string | null; author: string | null; metrics?: Record<string, string> } {
  if (preferred === "tiktok" && e.tiktokUrls[0]) {
    return { platform: "tiktok", url: e.tiktokUrls[0], author: `@${e.tiktokUrls[0].split("@")[1].split("/")[0]}` };
  }
  if (preferred === "instagram" && e.instagramUrls[0]) {
    return { platform: "instagram", url: e.instagramUrls[0], author: null };
  }
  const top = e.xPosts[0];
  if (top) {
    return {
      platform: "x",
      url: top.url,
      author: top.handle,
      metrics: { likes: compactNumber(top.likes), replies: compactNumber(top.replies) },
    };
  }
  if (e.tiktokUrls[0]) {
    return { platform: "tiktok", url: e.tiktokUrls[0], author: `@${e.tiktokUrls[0].split("@")[1].split("/")[0]}` };
  }
  return { platform: preferred, url: null, author: null };
}
