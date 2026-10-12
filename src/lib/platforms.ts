import type { Platform } from "./schema";

export type PlatformMeta = {
  id: Platform;
  label: string;
  /** Tailwind classes for the small badge shown on cards. */
  badge: string;
};

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  x: {
    id: "x",
    label: "X",
    badge: "bg-zinc-900 text-white",
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    badge: "bg-cyan-100 text-cyan-900",
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    badge: "bg-fuchsia-100 text-fuchsia-900",
  },
  reddit: {
    id: "reddit",
    label: "Reddit",
    badge: "bg-orange-100 text-orange-900",
  },
  youtube: {
    id: "youtube",
    label: "YouTube",
    badge: "bg-red-100 text-red-900",
  },
};
