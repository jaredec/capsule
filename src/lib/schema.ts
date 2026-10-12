import { z } from "zod";

export const PLATFORMS = ["x", "tiktok", "instagram", "reddit", "youtube"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const KINDS = ["video", "image", "phrase", "audio", "moment"] as const;
export type Kind = (typeof KINDS)[number];

export const referenceSchema = z.object({
  title: z.string().min(1),
  url: z.url(),
});

export const CATEGORIES = [
  "pop-culture",
  "celebrity",
  "tv-film",
  "music",
  "everyday-life",
  "animals",
  "food",
  "brands",
  "internet-culture",
  "sports",
  "tech",
  "politics",
  "news",
] as const;

/** How the picker scored an item; 1-10 scales. */
export const pulseSchema = z.object({
  score: z.number(),
  reach: z.number(),
  dominance: z.number(),
  memeability: z.number(),
  category: z.enum(CATEGORIES),
  crossover: z.boolean(),
});

export const itemSchema = z.object({
  id: z.string().min(1),
  platform: z.enum(PLATFORMS),
  rank: z.number().int().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  kind: z.enum(KINDS),
  tags: z.array(z.string()).default([]),
  author: z.string().nullish(),
  sourceUrl: z.url().nullish(),
  metrics: z.record(z.string(), z.union([z.string(), z.number()]).transform(String)).optional(),
  references: z.array(referenceSchema).default([]),
  pulse: pulseSchema.optional(),
  /** Self-hosted still under /public, so it can't expire or break when a platform rotates CDN URLs. */
  image: z
    .object({ src: z.string().startsWith("/media/"), width: z.number(), height: z.number(), from: z.url() })
    .optional(),
  collectedBy: z.string().min(1),
  collectedAt: z.string().min(1),
});

export const dayFileSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.array(itemSchema),
});

export type Reference = z.infer<typeof referenceSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Pulse = z.infer<typeof pulseSchema>;
export type DayFile = z.infer<typeof dayFileSchema>;
