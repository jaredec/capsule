import type { Item } from "./schema";

export type EmbedTarget =
  | { kind: "x"; url: string }
  | { kind: "youtube"; id: string }
  | { kind: "tiktok"; id: string }
  | { kind: "instagram"; id: string };

const X_STATUS_URL = /^https:\/\/(?:x|twitter)\.com\/\w+\/status\/\d+/;

/** The original post, if it's on a platform that lets us embed it inline. */
export function embedTarget(item: Item): EmbedTarget | null {
  const url = item.sourceUrl;
  if (!url) return null;
  if (item.platform === "x" && X_STATUS_URL.test(url)) return { kind: "x", url };

  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/)?.[1];
  if (item.platform === "youtube" && yt) return { kind: "youtube", id: yt };

  const tt = url.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/)?.[1];
  if (item.platform === "tiktok" && tt) return { kind: "tiktok", id: tt };

  const ig = url.match(/instagram\.com\/(?:p|reel)\/([\w-]+)/)?.[1];
  if (item.platform === "instagram" && ig) return { kind: "instagram", id: ig };

  return null;
}
