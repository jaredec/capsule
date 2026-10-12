import fs from "node:fs";
import path from "node:path";
import { itemId } from "./build";
import type { MediaOverrides } from "./media";
import type { Story } from "./pick";

export const PICKS_DIR = path.join(process.cwd(), "data", "picks");

/** An editor's stories for a day: what the picker would return, plus optional overrides. */
export type PickFile = {
  date: string;
  stories: (Omit<Story, "peakDay" | "why"> & MediaOverrides & { sourceUrl?: string })[];
};

export function readPicks(date: string): PickFile | null {
  const file = path.join(PICKS_DIR, `${date}.json`);
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as PickFile) : null;
}

/** The editor's image choices for a day, by item id. */
export function mediaOverrides(date: string): Map<string, MediaOverrides> {
  const out = new Map<string, MediaOverrides>();
  for (const { title, imageUrl, frameAt, crop } of readPicks(date)?.stories ?? []) {
    out.set(itemId(date, title), { imageUrl, frameAt, crop });
  }
  return out;
}
