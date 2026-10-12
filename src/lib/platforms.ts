import type { Platform } from "./schema";

export type PlatformMeta = {
  id: Platform;
  label: string;
};

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  x: { id: "x", label: "X" },
  tiktok: { id: "tiktok", label: "TikTok" },
  instagram: { id: "instagram", label: "Instagram" },
  reddit: { id: "reddit", label: "Reddit" },
  youtube: { id: "youtube", label: "YouTube" },
};
