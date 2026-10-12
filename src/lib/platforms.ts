import type { Platform } from "./schema";

export type PlatformMeta = {
  id: Platform;
  label: string;
  /** Tailwind classes for the small badge shown on cards. */
  badge: string;
  dot: string;
};

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  x: {
    id: "x",
    label: "X",
    badge: "bg-zinc-100 text-zinc-900",
    dot: "bg-zinc-100",
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    badge: "bg-cyan-300 text-zinc-900",
    dot: "bg-cyan-300",
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    badge: "bg-fuchsia-400 text-zinc-900",
    dot: "bg-fuchsia-400",
  },
  reddit: {
    id: "reddit",
    label: "Reddit",
    badge: "bg-orange-400 text-zinc-900",
    dot: "bg-orange-400",
  },
  youtube: {
    id: "youtube",
    label: "YouTube",
    badge: "bg-red-500 text-white",
    dot: "bg-red-500",
  },
};
