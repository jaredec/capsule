import { addDays, archiveDateOf } from "../../src/lib/dates";
import type { Reference } from "../../src/lib/schema";
import { decodeEntities, fetchText } from "./http";
import { resolveGoogleNewsUrl, type Headline } from "./sources/googleNews";

export type XPost = {
  url: string;
  handle: string;
  name: string;
  verified: boolean;
  avatarUrl: string | null;
  /** Post text with media links stripped and t.co links shown as their display URL. */
  text: string;
  likes: number;
  replies: number;
  createdAt: string;
  /** First photo, or the poster frame of a video. */
  mediaUrl: string | null;
};

export type Enrichment = {
  references: Reference[];
  xPosts: XPost[];
};

const X_STATUS = /https?:\/\/(?:www\.|mobile\.)?(?:twitter|x)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{8,20})/g;

type SyndicatedTweet = {
  text?: string;
  display_text_range?: [number, number];
  entities?: { urls?: { url: string; display_url: string }[]; media?: { indices: [number, number] }[] };
};

function postText(t: SyndicatedTweet): string {
  // display_text_range counts code points of the still-escaped text and excludes the trailing media link.
  const chars = [...(t.text ?? "")];
  const [start, rangeEnd] = t.display_text_range ?? [0, chars.length];
  // The range sometimes overlaps the media link by a character.
  const end = Math.min(rangeEnd, ...(t.entities?.media ?? []).map((m) => m.indices[0]));
  let text = chars.slice(start, end).join("");
  for (const u of t.entities?.urls ?? []) text = text.replace(u.url, u.display_url);
  return decodeEntities(text.replace(/https:\/\/t\.co\/\w+/g, "")).trim();
}

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
    const t = JSON.parse(text) as SyndicatedTweet & {
      __typename?: string;
      favorite_count?: number;
      conversation_count?: number;
      created_at?: string;
      user?: { screen_name?: string; name?: string; is_blue_verified?: boolean; verified?: boolean; profile_image_url_https?: string };
      mediaDetails?: { media_url_https?: string }[];
      photos?: { url?: string }[];
      video?: { poster?: string };
    };
    if (t.__typename === "TweetTombstone" || !t.user?.screen_name || !t.created_at) return null;
    return {
      url: `https://x.com/${t.user.screen_name}/status/${id}`,
      handle: `@${t.user.screen_name}`,
      name: t.user.name ?? t.user.screen_name,
      verified: Boolean(t.user.is_blue_verified || t.user.verified),
      avatarUrl: t.user.profile_image_url_https?.replace("_normal.", "_bigger.") ?? null,
      text: postText(t),
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

  for (const h of headlines.slice(0, maxArticles + 2)) {
    if (references.length >= maxArticles) break;
    const url = await resolveGoogleNewsUrl(h.gnId);
    if (!url) continue;
    references.push({ title: h.title, url });
    const html = await fetchText(url, { retries: 1, timeoutMs: 15_000 });
    if (!html) continue;
    for (const m of html.matchAll(X_STATUS)) if (m[1].toLowerCase() !== "i") statusIds.set(m[2], m[1]);
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

  return { references, xPosts };
}
