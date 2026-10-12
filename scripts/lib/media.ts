import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import type { Crop, Item } from "../../src/lib/schema";
import { lookupXPost, type XPost } from "./enrich";
import { completeJson, resolveLlm } from "./llm";
import { BROWSER_UA, decodeEntities, fetchText } from "./http";
import { renderPostCard } from "./postCard";

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

/** Preview images worth trying after the post's video: its photo or poster, then thumbnails and coverage images. */
async function imageCandidates(item: Item, post: XPost | null): Promise<string[]> {
  const out: string[] = [];
  if (post?.mediaUrl) out.push(post.mediaUrl.includes("pbs.twimg.com/media") ? `${post.mediaUrl}?name=medium` : post.mediaUrl);
  if (item.sourceUrl?.includes("tiktok.com")) {
    const thumb = await tiktokThumbnail(item.sourceUrl);
    if (thumb) out.push(thumb);
  }
  for (const url of [item.sourceUrl, ...item.references.map((r) => r.url)]) {
    const yt = url ? youtubeId(url) : null;
    // maxresdefault only exists for HD uploads; hqdefault always does, letterboxed to 4:3.
    if (yt) out.push(`https://i.ytimg.com/vi/${yt}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`);
  }
  for (const ref of item.references.slice(0, 3)) {
    if (youtubeId(ref.url)) continue;
    const html = await fetchText(ref.url, { retries: 1, timeoutMs: 15_000 });
    const img = html ? metaImage(html) : null;
    if (img && !GENERIC_IMAGE.test(img)) out.push(img);
  }
  return out;
}

async function download(url: string, type = "image/"): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": BROWSER_UA }, signal: AbortSignal.timeout(30_000) });
    if (!res.ok || !res.headers.get("content-type")?.startsWith(type)) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

const run = promisify(execFile);

async function videoFrame(file: string, seconds: number): Promise<Buffer | null> {
  try {
    const { stdout } = await run(
      "ffmpeg",
      ["-v", "error", "-ss", String(seconds), "-i", file, "-frames:v", "1", "-f", "image2pipe", "-vcodec", "png", "pipe:1"],
      { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 },
    );
    return stdout.length > 0 ? stdout : null;
  } catch {
    return null;
  }
}

/** Edge strength of a frame: blur, fades and motion smear score low; near-black or near-white frames score 0. */
async function sharpness(frame: Buffer): Promise<number> {
  const { data, info } = await sharp(frame).greyscale().resize({ width: 320 }).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let sum = 0;
  let sq = 0;
  for (const v of data) {
    sum += v;
    sq += v * v;
  }
  const mean = sum / data.length;
  if (mean < 25 || mean > 235) return 0;
  let lsum = 0;
  let lsq = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = data[i - 1] + data[i + 1] + data[i - w] + data[i + w] - 4 * data[i];
      lsum += l;
      lsq += l * l;
    }
  }
  const n = (w - 2) * (h - 2);
  const contrast = Math.sqrt(sq / data.length - mean * mean);
  return Math.sqrt(lsq / n - (lsum / n) ** 2) * Math.min(1, contrast / 45);
}

/** An 8x8 colour thumbnail, enough to tell scenes apart. */
async function signature(frame: Buffer): Promise<number[]> {
  return Array.from(await sharp(frame).resize(8, 8, { fit: "fill" }).removeAlpha().raw().toBuffer());
}

/** The frame closest to all the others: the video's dominant scene rather than a one-off cut. */
async function medoid(frames: Buffer[]): Promise<number> {
  const sigs = await Promise.all(frames.map(signature));
  const dist = (a: number[], b: number[]) => Math.sqrt(a.reduce((acc, v, i) => acc + (v - b[i]) ** 2, 0));
  const cost = sigs.map((a) => sigs.reduce((acc, b) => acc + dist(a, b), 0));
  return cost.indexOf(Math.min(...cost));
}

type FrameChoice = { frame: number };

/** Asks the configured LLM which frame shows the moment the item describes; null without a key or on failure. */
async function llmChoice(frames: Buffer[], item: Item): Promise<number | null> {
  const llm = resolveLlm();
  if (!llm) return null;
  try {
    const images = await Promise.all(frames.map((f) => sharp(f).resize({ width: 384 }).jpeg({ quality: 70 }).toBuffer()));
    const { data } = await completeJson<FrameChoice>(llm, {
      system:
        "You pick the cover still for a viral video in an archive of internet moments. Choose the frame that " +
        "a viewer would recognise as the moment itself: the person or thing the story is about, mid-action, " +
        "clearly visible. Avoid title cards, captions, blurred frames, cutaways and reaction shots of others.",
      user: `Story: ${item.title}\n${item.summary}\n\nThe ${frames.length} images are frames in order, numbered from 1. Reply with the number of the best frame.`,
      schemaName: "frame_choice",
      schema: {
        type: "object",
        properties: { frame: { type: "integer" } },
        required: ["frame"],
        additionalProperties: false,
      },
      images,
    });
    return Number.isInteger(data.frame) && data.frame >= 1 && data.frame <= frames.length ? data.frame - 1 : null;
  } catch {
    return null;
  }
}

// The opening and closing seconds are usually a black frame, a caption card or a reaction cut.
const FRAME_SAMPLES = 12;
const FRAME_WINDOW = [0.08, 0.92];

/**
 * A still that stands for the video: the frame at `at` seconds when the editor chose one, else
 * one of evenly spaced samples. Blurred and blank samples are dropped, then the LLM (when a key
 * is configured) picks the frame that shows the story, falling back to the dominant scene.
 */
async function representativeFrame(videoUrl: string, item: Item, at?: number): Promise<{ bytes: Buffer; at: number } | null> {
  const video = await download(videoUrl, "video/");
  if (!video) return null;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "capsule-"));
  const file = path.join(dir, "video.mp4");
  try {
    fs.writeFileSync(file, video);
    if (at !== undefined) {
      const bytes = await videoFrame(file, at);
      return bytes ? { bytes, at } : null;
    }
    const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
    const duration = Number(stdout.trim());
    if (!(duration > 0)) return null;
    const samples: { bytes: Buffer; at: number; sharpness: number }[] = [];
    for (let i = 0; i < FRAME_SAMPLES; i++) {
      const t = duration * (FRAME_WINDOW[0] + ((FRAME_WINDOW[1] - FRAME_WINDOW[0]) * i) / (FRAME_SAMPLES - 1));
      const bytes = await videoFrame(file, Math.round(t * 10) / 10);
      if (bytes) samples.push({ bytes, at: Math.round(t * 10) / 10, sharpness: await sharpness(bytes) });
    }
    if (samples.length === 0) return null;
    const sorted = samples.map((s) => s.sharpness).sort((a, b) => a - b);
    const cutoff = sorted[Math.floor(sorted.length / 2)] * 0.75;
    const usable = samples.filter((s) => s.sharpness > 0 && s.sharpness >= cutoff);
    const pool = usable.length > 0 ? usable : samples;
    const pick = (await llmChoice(pool.map((s) => s.bytes), item)) ?? (await medoid(pool.map((s) => s.bytes)));
    return pool[pick];
  } catch {
    return null;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

type Still = { from: string; bytes: Buffer | null };

const PHOTO_GAP = 4;

/** Two photos at the same height with a thin white gap, the way X lays out a two-photo post. */
async function sideBySide(urls: string[]): Promise<Buffer | null> {
  const files = await Promise.all(urls.map((u) => download(u.includes("pbs.twimg.com/media") ? `${u}?name=medium` : u)));
  if (files.some((f) => !f)) return null;
  try {
    const height = Math.min(...(await Promise.all(files.map(async (f) => (await sharp(f!).metadata()).height ?? 0))));
    if (!height) return null;
    const photos = await Promise.all(
      files.map((f) => sharp(f!).rotate().resize({ height }).png().toBuffer({ resolveWithObject: true })),
    );
    const width = photos.reduce((sum, p) => sum + p.info.width, PHOTO_GAP);
    return await sharp({ create: { width, height, channels: 3, background: "#ffffff" } })
      .composite([
        { input: photos[0].data, left: 0, top: 0 },
        { input: photos[1].data, left: photos[0].info.width + PHOTO_GAP, top: 0 },
      ])
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

/**
 * Stills to try, best first: the editor's image, a representative video frame, a two-photo post's
 * photos side by side, an image of the post itself when it's text-only, then preview images.
 */
async function* stills(
  item: Item,
  post: XPost | null,
  avatarFile: string | null,
  imageUrl?: string,
  frameAt?: number,
): AsyncGenerator<Still> {
  if (imageUrl) yield { from: imageUrl, bytes: await download(imageUrl) };
  if (post?.videoUrl) {
    const frame = await representativeFrame(post.videoUrl, item, frameAt);
    if (frame) yield { from: `${post.videoUrl}#t=${frame.at}`, bytes: frame.bytes };
  }
  if (post?.photos.length === 2) {
    yield { from: `${post.url}#photos`, bytes: await sideBySide(post.photos) };
  }
  if (post && !post.mediaUrl && !post.videoUrl && post.text) {
    yield { from: post.url, bytes: await renderPostCard(post, avatarFile).catch(() => null) };
  }
  for (const url of await imageCandidates(item, post)) yield { from: url, bytes: await download(url) };
}

async function storeImage(
  date: string,
  item: Item,
  post: XPost | null,
  log: (m: string) => void,
  { imageUrl, frameAt, avatarFile }: { imageUrl?: string; frameAt?: number; avatarFile: string | null },
): Promise<Item["image"]> {
  for await (const { from, bytes } of stills(item, post, avatarFile, imageUrl, frameAt)) {
    if (!bytes) continue;
    try {
      const image = sharp(bytes, { failOn: "none" });
      const meta = await image.metadata();
      if (!meta.width || meta.width < MIN_WIDTH) continue;
      const dir = path.join(MEDIA_DIR, date);
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${item.id}.webp`);
      const info = await image.rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true }).webp({ quality: 72 }).toFile(file);
      return { src: `/media/${date}/${item.id}.webp`, width: info.width, height: info.height, from };
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

/** Editor choices from a picks file; each beats what the pipeline would pick. */
export type MediaOverrides = {
  /** A still to use instead of the post's own media. */
  imageUrl?: string;
  /** Second of the post's video to use as the still. */
  frameAt?: number;
  crop?: Crop;
};

/**
 * Stores a still for the item under public/media/<date>/ with the region worth showing, and,
 * for X items, a snapshot of the featured post (author, avatar, text). For a video post the
 * still is a representative frame of the video rather than X's poster, which is usually the
 * opening frame.
 */
export async function attachMedia(
  date: string,
  item: Item,
  {
    redoImage = false,
    imageUrl,
    frameAt,
    crop,
    log = console.log,
  }: MediaOverrides & { redoImage?: boolean; log?: (m: string) => void } = {},
): Promise<Item> {
  const xId = item.sourceUrl?.match(/x\.com\/\w+\/status\/(\d+)/)?.[1];
  const post = xId ? await lookupXPost(xId) : null;
  const out: Item = { ...item };
  if (post) {
    out.post = {
      name: post.name,
      handle: post.handle,
      verified: post.verified,
      avatar: await storeAvatar(post),
      text: post.text,
      postedAt: new Date(post.createdAt).toISOString(),
    };
  }
  const from = item.image?.from ?? "";
  if (imageUrl ? from !== imageUrl : frameAt !== undefined && !from.endsWith(`#t=${frameAt}`)) redoImage = true;
  if (!item.image || redoImage) {
    const avatarFile = out.post?.avatar ? path.join("public", out.post.avatar) : null;
    const image = await storeImage(date, item, post, log, { imageUrl, frameAt, avatarFile });
    if (image) out.image = image;
    else delete out.image;
  }
  if (out.image) {
    const image = out.image;
    out.image = { ...image, crop: crop ?? (redoImage ? undefined : image.crop) ?? (await autoCrop(path.join("public", image.src))) };
  }
  return out;
}
