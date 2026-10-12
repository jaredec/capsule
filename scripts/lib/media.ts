import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { Item } from "../../src/lib/schema";
import { lookupXPost } from "./enrich";
import { BROWSER_UA, decodeEntities, fetchText } from "./http";

const MEDIA_DIR = path.join(process.cwd(), "public", "media");
const MAX_WIDTH = 720;
const MIN_WIDTH = 300;

function metaImage(html: string): string | null {
  for (const prop of ["og:image", "twitter:image", "og:image:url"]) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`,
      "i",
    );
    const m = html.match(re);
    const url = m?.[1] ?? m?.[2];
    if (url && /^https?:\/\//.test(url)) return decodeEntities(url);
  }
  return null;
}

async function tiktokThumbnail(url: string): Promise<string | null> {
  const text = await fetchText(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { retries: 1 });
  if (!text) return null;
  try {
    return (JSON.parse(text) as { thumbnail_url?: string }).thumbnail_url ?? null;
  } catch {
    return null;
  }
}

// Site-wide fallbacks (logos, placeholders) say nothing about the moment itself.
const GENERIC_IMAGE = /logo|placeholder|default[-_]|favicon|fallback|social[-_]share|og[-_]default/i;

function youtubeId(url: string): string | null {
  return url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/)?.[1] ?? null;
}

/** Candidate stills, best first: the post's own media, then preview images from the coverage. */
async function imageCandidates(item: Item): Promise<string[]> {
  const out: string[] = [];
  const xId = item.sourceUrl?.match(/x\.com\/\w+\/status\/(\d+)/)?.[1];
  if (xId) {
    const post = await lookupXPost(xId);
    if (post?.mediaUrl) out.push(post.mediaUrl.includes("pbs.twimg.com/media") ? `${post.mediaUrl}?name=medium` : post.mediaUrl);
  }
  if (item.sourceUrl?.includes("tiktok.com")) {
    const thumb = await tiktokThumbnail(item.sourceUrl);
    if (thumb) out.push(thumb);
  }
  for (const url of [item.sourceUrl, ...item.references.map((r) => r.url)]) {
    const yt = url ? youtubeId(url) : null;
    if (yt) out.push(`https://i.ytimg.com/vi/${yt}/hqdefault.jpg`);
  }
  for (const ref of item.references.slice(0, 3)) {
    if (youtubeId(ref.url)) continue;
    const html = await fetchText(ref.url, { retries: 1, timeoutMs: 15_000 });
    const img = html ? metaImage(html) : null;
    if (img && !GENERIC_IMAGE.test(img)) out.push(img);
  }
  return out;
}

async function download(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA }, signal: AbortSignal.timeout(20_000) });
    if (!res.ok || !res.headers.get("content-type")?.startsWith("image/")) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

/** Finds, downsizes and stores a still for the item under public/media/<date>/. */
export async function attachImage(date: string, item: Item, log: (m: string) => void = console.log): Promise<Item> {
  for (const url of await imageCandidates(item)) {
    const bytes = await download(url);
    if (!bytes) continue;
    try {
      const image = sharp(bytes, { failOn: "none" });
      const meta = await image.metadata();
      if (!meta.width || meta.width < MIN_WIDTH) continue;
      const dir = path.join(MEDIA_DIR, date);
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${item.id}.webp`);
      const info = await image.rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality: 72 }).toFile(file);
      return { ...item, image: { src: `/media/${date}/${item.id}.webp`, width: info.width, height: info.height, from: url } };
    } catch {
      continue;
    }
  }
  log(`    no usable image for "${item.title}"`);
  return item;
}
