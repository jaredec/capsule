import fs from "node:fs";
import sharp, { type OverlayOptions } from "sharp";
import type { XPost } from "./enrich";

// A 3:4 card fills a calendar cell without cropping.
const WIDTH = 720;
const HEIGHT = 960;
const PAD = 56;
const AVATAR = 88;
const FONT = "Inter, Helvetica Neue, Arial, Liberation Sans, DejaVu Sans";
const INK = "#0f1419";
const MUTED = "#536471";
const BLUE = "#1d9bf0";

const VERIFIED_SVG = (size: number) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 22 22"><path fill="${BLUE}" d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"/></svg>`,
  );

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

type Rendered = { data: Buffer; width: number; height: number };

/** Pango markup rendered at 72 dpi, so sizes are pixels. */
async function text(markup: string, size: number, width?: number): Promise<Rendered> {
  const { data, info } = await sharp({
    text: {
      text: markup,
      font: `${FONT} ${size}`,
      dpi: 72,
      rgba: true,
      ...(width ? { width, wrap: "word" as const } : {}),
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function avatar(file: string | null): Promise<Buffer> {
  const mask = Buffer.from(`<svg width="${AVATAR}" height="${AVATAR}"><circle cx="${AVATAR / 2}" cy="${AVATAR / 2}" r="${AVATAR / 2}"/></svg>`);
  const base = file && fs.existsSync(file)
    ? sharp(file).resize(AVATAR, AVATAR, { fit: "cover" })
    : sharp({ create: { width: AVATAR, height: AVATAR, channels: 4, background: "#cfd9de" } });
  return base.composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

function timestamp(createdAt: string): string {
  const d = new Date(createdAt);
  const tz = "America/Los_Angeles";
  const time = d.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
  const day = d.toLocaleDateString("en-US", { timeZone: tz, month: "short", day: "numeric", year: "numeric" });
  return `${time} · ${day}`;
}

/**
 * A light-mode image of a text-only post, laid out like the post on X, for days whose featured post has no
 * photo or video. Long posts end in "Show more" like the timeline, since the embed endpoint only returns
 * their first 280 characters. The text shrinks until the post fits the card.
 */
export async function renderPostCard(post: XPost, avatarFile: string | null): Promise<Buffer> {
  const inner = WIDTH - 2 * PAD;
  const body = escape(post.text) + (post.truncated ? `… <span foreground="${BLUE}">Show\u00a0more</span>` : "");
  const header = 88;
  const gap = 32;
  const footer = await text(`<span foreground="${MUTED}">${escape(timestamp(post.createdAt))}</span>`, 26);
  let size = 40;
  let rendered = await text(`<span foreground="${INK}">${body}</span>`, size, inner);
  while (header + gap + rendered.height + gap + footer.height > HEIGHT - 2 * PAD && size > 22) {
    size -= 2;
    rendered = await text(`<span foreground="${INK}">${body}</span>`, size, inner);
  }

  const nameX = PAD + AVATAR + 20;
  const name = await text(`<span foreground="${INK}" weight="bold">${escape(post.name)}</span>`, 32);
  const handle = await text(`<span foreground="${MUTED}">${escape(post.handle)}</span>`, 28);
  const top = Math.round((HEIGHT - (header + gap + rendered.height + gap + footer.height)) / 2);
  const layers: OverlayOptions[] = [
    { input: await avatar(avatarFile), left: PAD, top },
    { input: name.data, left: nameX, top: top + 8 },
    { input: handle.data, left: nameX, top: top + 50 },
    { input: rendered.data, left: PAD, top: top + header + gap },
    { input: footer.data, left: PAD, top: top + header + gap + rendered.height + gap },
  ];
  if (post.verified) layers.push({ input: VERIFIED_SVG(30), left: nameX + name.width + 6, top: top + 10 });
  return sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: "#ffffff" } })
    .composite(layers)
    .png()
    .toBuffer();
}
