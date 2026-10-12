import { z } from "zod";

export const PLATFORMS = ["x", "tiktok", "instagram", "reddit", "youtube"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const KINDS = ["video", "image", "phrase", "audio", "moment"] as const;
export type Kind = (typeof KINDS)[number];

export const referenceSchema = z.object({
  title: z.string().min(1),
  url: z.url(),
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
  collectedBy: z.string().min(1),
  collectedAt: z.string().min(1),
});

export const dayFileSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  items: z.array(itemSchema),
});

export type Reference = z.infer<typeof referenceSchema>;
export type Item = z.infer<typeof itemSchema>;
export type DayFile = z.infer<typeof dayFileSchema>;
