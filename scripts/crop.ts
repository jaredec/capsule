/**
 * Shows how a day's image sits in every frame the site draws it in, next to the whole image
 * with a coordinate grid, so a crop can be judged, or a new one tried, in one look.
 *
 *   npm run crop -- 2026-11-15                                  # every item that day
 *   npm run crop -- 2026-11-15 x --crop .38,.55,.2,.4           # try a subject box
 *   npm run crop -- 2026-11-15 x --bounds 0,0,1,.8 --image f.jpg # and bounds, on another picture
 *
 * Writes <tmpdir>/capsule-crop/<date>-<platform>.png and prints its path along with the crop
 * as picks-file JSON. Nothing in data/ changes.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp, { type OverlayOptions } from "sharp";
import { cropView } from "../src/lib/crop";
import type { Crop } from "../src/lib/schema";
import { readDay } from "./lib/store";

// The frames an image appears in: a calendar cell, the desktop day card's image pane, and the
// mobile day card's header, at roughly their on-screen sizes.
const FRAMES = [
  { label: "calendar cell", width: 165, height: 220 },
  { label: "day card, desktop", width: 304, height: 310 },
  { label: "day card, mobile", width: 320, height: 240 },
];
const IMAGE_WIDTH = 900;
const GAP = 24;
const LABEL = 22;

function parseBox(value: string | undefined, flag: string): Crop | undefined {
  if (value === undefined) return undefined;
  const [x, y, w, h] = value.split(",").map(Number);
  if ([x, y, w, h].some((n) => !Number.isFinite(n)) || w <= 0 || h <= 0) throw new Error(`${flag} wants x,y,w,h fractions, got "${value}"`);
  return { x, y, w, h };
}

async function readImage(source: string): Promise<Buffer> {
  if (!/^https?:/.test(source)) return fs.readFileSync(source);
  const res = await fetch(source);
  if (!res.ok) throw new Error(`${source}: HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function text(x: number, y: number, value: string, size = 13, anchor = "start") {
  return `<text x="${x}" y="${y}" font-family="Helvetica, Arial" font-size="${size}" fill="#fff" stroke="#000" stroke-width="3" paint-order="stroke" text-anchor="${anchor}">${value}</text>`;
}

/** The whole image with a tenths grid, the subject box (yellow) and bounds (cyan), outside the subject dimmed. */
function guides(width: number, height: number, crop?: Crop, bounds?: Crop) {
  const box = (b: Crop) => [b.x * width, b.y * height, b.w * width, b.h * height];
  const parts: string[] = [];
  for (let i = 1; i < 10; i++) {
    const x = (i / 10) * width;
    const y = (i / 10) * height;
    parts.push(`<line x1="${x}" y1="0" x2="${x}" y2="${height}" stroke="#fff" stroke-opacity="${i === 5 ? 0.6 : 0.3}"/>`);
    parts.push(`<line x1="0" y1="${y}" x2="${width}" y2="${y}" stroke="#fff" stroke-opacity="${i === 5 ? 0.6 : 0.3}"/>`);
    parts.push(text(x, 14, `.${i}`, 12, "middle"), text(4, y + 4, `.${i}`, 12));
  }
  if (crop) {
    const [x, y, w, h] = box(crop);
    parts.push(`<path fill-rule="evenodd" fill="#000" fill-opacity="0.4" d="M0 0H${width}V${height}H0Z M${x} ${y}h${w}v${h}h${-w}Z"/>`);
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#facc15" stroke-width="2"/>`);
  }
  if (bounds) {
    const [x, y, w, h] = box(bounds);
    parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#22d3ee" stroke-width="2" stroke-dasharray="8 5"/>`);
  }
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${parts.join("")}</svg>`);
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(name);
    return i === -1 ? undefined : args.splice(i, 2)[1];
  };
  const crop = parseBox(flag("--crop"), "--crop");
  const bounds = parseBox(flag("--bounds"), "--bounds");
  const imageSource = flag("--image");
  const [date, platform] = args;
  if (!date) throw new Error("usage: npm run crop -- <date> [platform] [--crop x,y,w,h] [--bounds x,y,w,h] [--image file|url]");

  const items = readDay(date).items.filter((i) => !platform || i.platform === platform);
  if (items.length === 0) throw new Error(`${date}: no ${platform ?? ""} item`.replace("  ", " "));
  const outDir = path.join(os.tmpdir(), "capsule-crop");
  fs.mkdirSync(outDir, { recursive: true });

  for (const item of items) {
    const stored = item.image;
    if (!stored && !imageSource) {
      console.log(`${date} ${item.platform}: no image`);
      continue;
    }
    const bytes = imageSource ? await readImage(imageSource) : fs.readFileSync(path.join("public", stored!.src));
    const source = sharp(bytes, { failOn: "none" }).rotate();
    const { width = 0, height = 0 } = await source.clone().toBuffer({ resolveWithObject: true }).then((r) => r.info);
    const image = {
      width,
      height,
      crop: crop ?? (imageSource ? undefined : stored?.crop),
      bounds: bounds ?? (imageSource ? undefined : stored?.bounds),
    };

    const shownHeight = Math.round((IMAGE_WIDTH * height) / width);
    const whole = await source.clone().resize(IMAGE_WIDTH, shownHeight).toBuffer();
    const layers: OverlayOptions[] = [
      { input: whole, left: 0, top: 0 },
      { input: guides(IMAGE_WIDTH, shownHeight, image.crop, image.bounds), left: 0, top: 0 },
    ];
    const labels: string[] = [];
    let top = 0;
    const left = IMAGE_WIDTH + GAP;
    for (const frame of FRAMES) {
      const view = cropView(image, frame.width / frame.height);
      const region = {
        left: Math.max(0, Math.round(view.x * width)),
        top: Math.max(0, Math.round(view.y * height)),
        width: Math.min(width, Math.round(view.w * width)),
        height: Math.min(height, Math.round(view.h * height)),
      };
      region.width = Math.min(region.width, width - region.left);
      region.height = Math.min(region.height, height - region.top);
      const shot = await source.clone().extract(region).resize(frame.width, frame.height, { fit: "fill" }).toBuffer();
      labels.push(text(left, top + 15, frame.label));
      layers.push({ input: shot, left, top: top + LABEL });
      top += LABEL + frame.height + GAP;
    }
    const canvasWidth = left + Math.max(...FRAMES.map((f) => f.width));
    const canvasHeight = Math.max(shownHeight, top - GAP);
    layers.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}">${labels.join("")}</svg>`), left: 0, top: 0 });

    const out = path.join(outDir, `${date}-${item.platform}.png`);
    await sharp({ create: { width: canvasWidth, height: canvasHeight, channels: 3, background: "#18181b" } }).composite(layers).png().toFile(out);
    const json = (b?: Crop) => (b ? JSON.stringify(b).replaceAll(":", ": ").replaceAll(",", ", ") : "none");
    console.log(`${date} ${item.platform}: ${out}\n  "crop": ${json(image.crop)}\n  "bounds": ${json(image.bounds)}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
