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
  /** A long post: the embed endpoint only returns its first 280 characters. */
  truncated: boolean;
  likes: number;
  replies: number;
  createdAt: string;
  /** X's language code for the text: "en", "pt", ... or a non-language code like "zxx" (media only). */
  lang: string | null;
  /** First photo, or the poster frame of a video (the quoted post's when the post has none). */
  mediaUrl: string | null;
  /** Every attached photo, in order. */
  photos: string[];
  /** The video as an MP4, for picking a still that shows the moment rather than its first frame. */
  videoUrl: string | null;
  /** Whether the post attached its own photo or video (rather than only quoting one). */
  hasOwnMedia: boolean;
  /** The post this one quotes, if any. */
  quoted: XPost | null;
};

export type Enrichment = {
  references: Reference[];
  xPosts: XPost[];
};

const X_STATUS = /https?:\/\/(?:www\.|mobile\.)?(?:twitter|x)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{8,20})/g;

type SyndicatedMedia = {
  mediaDetails?: { media_url_https?: string }[];
  photos?: { url?: string }[];
  video?: { poster?: string; variants?: { type?: string; src?: string }[] };
};

function media(t: SyndicatedMedia): Pick<XPost, "mediaUrl" | "photos" | "videoUrl"> {
  // Variant URLs carry their size (".../vid/avc1/720x1280/..."); the smallest whose short side
  // reaches 720px is plenty for a 720px still and avoids downloading 4K files.
  const mp4s = (t.video?.variants ?? [])
    .filter((v) => v.type === "video/mp4" && v.src)
    .map((v) => {
      const [w, h] = (v.src!.match(/\/(\d+)x(\d+)\//) ?? []).slice(1).map(Number);
      return { src: v.src!, short: Math.min(w || 0, h || 0) };
    })
    .sort((a, b) => a.short - b.short);
  return {
    mediaUrl: t.photos?.[0]?.url ?? t.video?.poster ?? t.mediaDetails?.[0]?.media_url_https ?? null,
    photos: (t.photos ?? []).flatMap((p) => (p.url ? [p.url] : [])),
    videoUrl: (mp4s.find((v) => v.short >= 720) ?? mp4s.at(-1))?.src ?? null,
  };
}

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

type Syndicated = SyndicatedTweet & SyndicatedMedia & {
  __typename?: string;
  id_str?: string;
  favorite_count?: number;
  conversation_count?: number;
  created_at?: string;
  lang?: string;
  user?: { screen_name?: string; name?: string; is_blue_verified?: boolean; verified?: boolean; profile_image_url_https?: string };
  quoted_tweet?: Syndicated;
  note_tweet?: unknown;
};

function toXPost(t: Syndicated, id: string): XPost | null {
  if (t.__typename === "TweetTombstone" || !t.user?.screen_name || !t.created_at) return null;
  const quoted = t.quoted_tweet?.id_str ? toXPost(t.quoted_tweet, t.quoted_tweet.id_str) : null;
  const hasOwnMedia = Boolean(t.mediaDetails?.length || t.photos?.length || t.video);
  return {
    url: `https://x.com/${t.user.screen_name}/status/${id}`,
    handle: `@${t.user.screen_name}`,
    name: t.user.name ?? t.user.screen_name,
    verified: Boolean(t.user.is_blue_verified || t.user.verified),
    avatarUrl: t.user.profile_image_url_https?.replace("_normal.", "_bigger.") ?? null,
    text: postText(t),
    truncated: Boolean(t.note_tweet),
    likes: t.favorite_count ?? 0,
    replies: t.conversation_count ?? 0,
    createdAt: t.created_at,
    lang: t.lang ?? null,
    ...(hasOwnMedia || !t.quoted_tweet ? media(t) : media(t.quoted_tweet)),
    hasOwnMedia,
    quoted,
  };
}

/** Public, unauthenticated post lookup (what embedded posts use). Costs nothing. */
export async function lookupXPost(id: string): Promise<XPost | null> {
  const text = await fetchText(
    `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${syndicationToken(id)}`,
    { retries: 1 },
  );
  if (!text) return null;
  try {
    return toXPost(JSON.parse(text) as Syndicated, id);
  } catch {
    return null;
  }
}

/**
 * A quote post piles onto the post it quotes, even when it out-likes it, so feature the original.
 * The rare quote that is the viral thing itself has to be pinned by the editor.
 */
export function originalPost(post: XPost): XPost {
  return post.quoted ? originalPost(post.quoted) : post;
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
    if (day < windowStart || day > windowEnd) continue;
    const featured = originalPost(post);
    if (!xPosts.some((p) => p.url === featured.url)) xPosts.push(featured);
  }
  xPosts.sort((a, b) => languageRank(a) - languageRank(b) || b.likes - a.likes);

  return { references, xPosts };
}

// X's codes for posts without real text: media or links only, emoji, hashtags, mentions, too short.
const NO_LANGUAGE = new Set(["zxx", "und", "qme", "qam", "qct", "qht", "qst", "art"]);

/** The featured post is quoted in an English archive: English first, then posts with no text to read, then the rest. */
function languageRank(post: XPost): number {
  if (post.lang === "en") return 0;
  return post.lang === null || NO_LANGUAGE.has(post.lang) ? 1 : 2;
}
