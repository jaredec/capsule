import type { Platform } from "../../src/lib/schema";
import { normalizeUrl } from "./grok";

const POST_URL_PATTERNS: Record<Platform, RegExp> = {
  x: /^https:\/\/x\.com\/\w{1,15}\/status\/\d+$/,
  tiktok: /^https:\/\/tiktok\.com\/@[\w.]+\/video\/\d+$/,
  instagram: /^https:\/\/instagram\.com\/(?:p|reel|reels)\/[\w-]+$/,
  reddit: /^https:\/\/reddit\.com\/r\/\w+\/comments\/\w+/,
  youtube: /^https:\/\/(?:youtube\.com\/(?:shorts\/[\w-]{11}|watch)|youtu\.be\/[\w-]{11})/,
};

// Public oEmbed endpoints answer 404 for posts that don't exist, which catches
// hallucinated post IDs without needing platform API credentials.
const OEMBED: Partial<Record<Platform, (url: string) => string>> = {
  x: (url) => `https://publish.twitter.com/oembed?omit_script=true&url=${encodeURIComponent(url)}`,
  tiktok: (url) => `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
  youtube: (url) => `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`,
};

export type Verification = { url: string | null; reason: string };

export async function verifyPostUrl(
  platform: Platform,
  rawUrl: string | null,
  citations: Set<string>,
): Promise<Verification> {
  if (!rawUrl) return { url: null, reason: "no url returned" };
  const url = normalizeUrl(rawUrl);
  if (!POST_URL_PATTERNS[platform].test(url)) return { url: null, reason: `not a ${platform} post url: ${url}` };

  const cited = citations.has(url);
  const oembed = OEMBED[platform];
  if (oembed) {
    try {
      const res = await fetch(oembed(url), { signal: AbortSignal.timeout(15_000) });
      if (res.ok) return { url, reason: cited ? "cited + oembed" : "oembed" };
      if (res.status === 404) return { url: null, reason: "post not found via oembed" };
    } catch {
      // Network trouble: fall back to citation check below.
    }
  }
  return cited ? { url, reason: "cited" } : { url: null, reason: "url not among search citations" };
}

export function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}
