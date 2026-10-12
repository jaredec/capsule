import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { Crop, Item } from "../../src/lib/schema";
import { lookupXPost, type XPost } from "./enrich";
import { BROWSER_UA, decodeEntities, fetchText } from "./http";

const MEDIA_DIR = path.join(process.cwd(), "public", "media");
const MAX_WIDTH = 720;
const MIN_WIDTH = 300;
const AVATAR_SIZE = 96;

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
async function imageCandidates(item: Item, post: XPost | null, preferred?: string): Promise<string[]> {
  const out: string[] = preferred ? [preferred] : [];
  if (post?.mediaUrl) out.push(post.mediaUrl.includes("pbs.twimg.com/media") ? `${post.mediaUrl}?name=medium` : post.mediaUrl);
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

async function storeImage(
  date: string,
  item: Item,
  post: XPost | null,
  log: (m: string) => void,
  preferred?: string,
): Promise<Item["image"]> {
  for (const url of await imageCandidates(item, post, preferred)) {
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
      return { src: `/media/${date}/${item.id}.webp`, width: info.width, height: info.height, from: url };
    } catch {
      continue;
    }
  }
  log(`    no usable image for "${item.title}"`);
  return undefined;
}

// Calendar cells are 3:4; the automatic crop is the 3:4 window around the most salient spot.
const CELL_ASPECT = 3 / 4;

/** The largest cell-shaped window centred (as far as the edges allow) on what sharp finds most eye-catching. */
async function autoCrop(file: string): Promise<Crop | undefined> {
  try {
    const { width: W = 0, height: H = 0 } = await sharp(file).metadata();
    if (!W || !H) return undefined;
    const scale = Math.max(300 / W, 400 / H);
    const { info } = await sharp(file)
      .resize(300, 400, { fit: "cover", position: sharp.strategy.attention })
      .toBuffer({ resolveWithObject: true });
    const ax = (info.attentionX ?? (W * scale) / 2) / (W * scale);
    const ay = (info.attentionY ?? (H * scale) / 2) / (H * scale);
    const round = (v: number) => Math.round(v * 1000) / 1000;
    const clamp = (v: number, size: number) => round(Math.min(1 - size, Math.max(0, v - size / 2)));
    if (W / H > CELL_ASPECT) {
      const w = round((CELL_ASPECT * H) / W);
      return { x: clamp(ax, w), y: 0, w, h: 1 };
    }
    const h = round(W / CELL_ASPECT / H);
    return { x: 0, y: clamp(ay, h), w: 1, h };
  } catch {
    return undefined;
  }
}

async function storeAvatar(post: XPost): Promise<string | null> {
  const bytes = post.avatarUrl ? await download(post.avatarUrl) : null;
  if (!bytes) return null;
  const name = `${post.handle.slice(1).toLowerCase()}.webp`;
  try {
    fs.mkdirSync(path.join(MEDIA_DIR, "avatars"), { recursive: true });
    await sharp(bytes, { failOn: "none" })
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: "cover" })
      .webp({ quality: 80 })
      .toFile(path.join(MEDIA_DIR, "avatars", name));
    return `/media/avatars/${name}`;
  } catch {
    return null;
  }
}

/**
 * Stores a still for the item under public/media/<date>/ with the region worth showing, and,
 * for X items, a snapshot of the featured post (author, avatar, text). An editor's imageUrl
 * wins over the post's own media, and an editor's crop over the automatic one.
 */
export async function attachMedia(
  date: string,
  item: Item,
  {
    redoImage = false,
    crop,
    imageUrl,
    log = console.log,
  }: { redoImage?: boolean; crop?: Crop; imageUrl?: string; log?: (m: string) => void } = {},
): Promise<Item> {
  const xId = item.sourceUrl?.match(/x\.com\/\w+\/status\/(\d+)/)?.[1];
  const post = xId ? await lookupXPost(xId) : null;
  const out: Item = { ...item };
  if (post) {
    out.post = { name: post.name, handle: post.handle, verified: post.verified, avatar: await storeAvatar(post), text: post.text };
  }
  if (imageUrl && item.image?.from !== imageUrl) redoImage = true;
  if (!item.image || redoImage) {
    const image = await storeImage(date, item, post, log, imageUrl);
    if (image) out.image = image;
    else delete out.image;
  }
  if (out.image) {
    const image = out.image;
    out.image = { ...image, crop: crop ?? (redoImage ? undefined : image.crop) ?? (await autoCrop(path.join("public", image.src))) };
  }
  return out;
}
