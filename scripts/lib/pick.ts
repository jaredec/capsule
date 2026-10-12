import { ARCHIVE_TIME_ZONE, addDays } from "../../src/lib/dates";
import { CATEGORIES, KINDS, PLATFORMS, type Kind, type Platform, type Pulse } from "../../src/lib/schema";
import { completeJson, type LlmConfig } from "./llm";
import type { Signals } from "./signals";

export type Story = {
  title: string;
  summary: string;
  kind: Kind;
  tags: string[];
  category: Pulse["category"];
  crossover: boolean;
  reach: number;
  dominance: number;
  memeability: number;
  platform: Platform;
  peakDay: "target" | "previous" | "next";
  headlineIds: number[];
  why: string;
};

export type ScoredStory = Story & { pulse: Pulse };

const NICHE_CATEGORIES = new Set<Pulse["category"]>(["sports", "tech", "politics", "news"]);

/**
 * Deterministic final score so the ranking rule is explicit and tunable, rather than
 * buried in the model's ordering. Sports/tech/politics/news only compete at full strength
 * when they crossed over into general meme culture. Politics gets boosted by partisan accounts
 * without reaching normal people, so it also needs near-total reach.
 */
export function scoreStory(s: Pick<Story, "reach" | "dominance" | "memeability" | "category" | "crossover">): number {
  const base = 0.4 * s.reach + 0.35 * s.dominance + 0.25 * s.memeability;
  const penalty =
    s.category === "politics"
      ? s.crossover && s.reach >= 9 ? 0.9 : 0.4
      : NICHE_CATEGORIES.has(s.category) ? (s.crossover ? 0.9 : 0.55) : 1;
  return Math.round(base * penalty * 10) / 10;
}

const score1to10 = { type: "integer", minimum: 1, maximum: 10 };

const STORY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["stories"],
  properties: {
    stories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "title", "summary", "kind", "tags", "category", "crossover", "reach", "dominance",
          "memeability", "platform", "peakDay", "headlineIds", "why",
        ],
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          kind: { type: "string", enum: [...KINDS] },
          tags: { type: "array", items: { type: "string" } },
          category: { type: "string", enum: [...CATEGORIES] },
          crossover: { type: "boolean" },
          reach: score1to10,
          dominance: score1to10,
          memeability: score1to10,
          platform: { type: "string", enum: [...PLATFORMS] },
          peakDay: { type: "string", enum: ["target", "previous", "next"] },
          headlineIds: { type: "array", items: { type: "integer" } },
          why: { type: "string" },
        },
      },
    },
  },
};

const SYSTEM = `You are the editor of Capsule, an archive of the internet's daily pulse. For each day you pick what controlled the feed: the thing a normal person (not a terminally online one) would have seen reposted, heard coworkers mention, or had explained to them by a friend.

Scoring, each 1-10:
- reach: did it escape its niche and reach "normies"? 10 = your aunt saw it.
- dominance: how hard did it take over feeds that day? Mass reposts, quote-posts, duets, stitches, "everyone is talking about", many outlets covering the reaction itself.
- memeability: did it spawn remixes, templates, catchphrases, reaction images, parodies?

Editorial rules:
- Prefer memes, pure internet absurdity, everyday-life drama, animals, food, brands, and pop culture moments people riffed on.
- A celebrity story only counts when the celebrity became the joke or did something memeable that non-fans reposted for the laugh (a coach revealing a 12-year Minecraft city, an actor's old photo turned into a caption template, a comedian's skit). Fan-account content is NOT the pulse: red carpets, outfits, lip-syncs, thirst clips, cute candids, cast reunions, trailers, interviews, "X did Y and fans are losing it". For those set memeability and reach low.
- Sports, tech/AI, business, and politics are normally NOT the pulse. Only set crossover=true when the moment became an instant meme shared by people who don't follow that world (e.g. a clip non-fans reposted for the joke, not for the game).
- Politics almost never qualifies: political clips get boosted by partisan accounts and outlets without reaching normal people. This covers politicians, their families, and anyone who is only in the news because of a political event (an Oval Office guest, a rally moment). Only a mega-viral meme that everyone saw and remixed regardless of their politics counts, on the scale of the Marco Rubio couch meme; then set category=politics, crossover=true and reach 9 or 10. An awkward rally moment, a gaffe or a guest's odd appearance does not qualify.
- Skip tragedies, crime, and local human-interest stories unless they became a genuine nationwide meme.
- Skip recycled engagement bait that resurfaces every few months (then-vs-now comparisons, "remember this", nostalgia screenshots). A day's pick should be tied to that day: something that happened, was posted, or newly took off then.
- The story must have peaked on the target date (a US Pacific-time day). Headlines from the following day often recap the target day; use peakDay to say when it actually peaked.
- Merge headlines about the same thing into one story and list all their ids in headlineIds (most informative first). Only cite ids from the list.
- Do not repeat stories already picked on recent days.
- Write the title as a short punchy archival headline (max ~70 chars) and the summary in 2-3 sentences: what happened, why it blew up, how people riffed on it. No emojis, no hype words like "breaks the internet".`;

const stampFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ARCHIVE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const pacificStamp = (iso: string) => stampFormatter.format(new Date(iso)).replace(",", "");

function formatSignals(signals: Signals, recentTitles: string[]): string {
  const lines: string[] = [];
  lines.push(`TARGET DATE: ${signals.date} (US Pacific time). The day after is ${addDays(signals.date, 1)}.`);
  if (recentTitles.length > 0) {
    lines.push("", "ALREADY PICKED ON RECENT DAYS (do not repeat):", ...recentTitles.map((t) => `- ${t}`));
  }
  if (signals.trendingSearches.length > 0) {
    lines.push("", "GOOGLE TRENDING SEARCHES (US):");
    for (const t of signals.trendingSearches) lines.push(`- ${t.query} (${t.traffic})`);
  }
  const wiki = signals.wikipedia.filter((w, i) => w.breakout || i < 25);
  if (wiki.length > 0) {
    lines.push("", "MOST-READ WIKIPEDIA PAGES (breakout = not in top 1000 on the prior 3 days):");
    for (const w of wiki) lines.push(`- ${w.title}: ${w.views.toLocaleString("en-US")} views${w.breakout ? " [breakout]" : ""}`);
  }
  lines.push("", "HEADLINES (id, published Pacific time, title, outlet):");
  for (const h of signals.headlines) lines.push(`[${h.id}] ${pacificStamp(h.publishedAt)} ${h.title} (${h.source})`);
  return lines.join("\n");
}

/**
 * `stories` are the day's picks: the top `count` candidates that peaked on the target day.
 * A day is never left empty, so when none did, the strongest candidate stands in. `reserves`
 * are the remaining candidates, strongest first, for when a pick has no usable source.
 */
export async function pickStories(
  llm: LlmConfig,
  signals: Signals,
  opts: { count: number; recentTitles: string[] },
): Promise<{ stories: ScoredStory[]; reserves: ScoredStory[]; usage: unknown }> {
  const user = `${formatSignals(signals, opts.recentTitles)}

Return the ${opts.count + 3} strongest candidates for this day's pulse, strongest first.`;
  const { data, usage } = await completeJson<{ stories: Story[] }>(llm, {
    system: SYSTEM,
    user,
    schemaName: "capsule_pulse",
    schema: STORY_SCHEMA,
  });

  const validIds = new Set(signals.headlines.map((h) => h.id));
  const candidates = data.stories
    .map((s) => ({ ...s, headlineIds: s.headlineIds.filter((id) => validIds.has(id)) }))
    .filter((s) => s.headlineIds.length > 0)
    .map((s) => ({
      ...s,
      pulse: {
        score: scoreStory(s),
        reach: s.reach,
        dominance: s.dominance,
        memeability: s.memeability,
        category: s.category,
        crossover: s.crossover,
      },
    }))
    .sort((a, b) => b.pulse.score - a.pulse.score);
  const onDay = candidates.filter((s) => s.peakDay === "target");
  const stories = onDay.length > 0 ? onDay.slice(0, opts.count) : candidates.slice(0, 1);
  const reserves = [...onDay, ...candidates.filter((s) => s.peakDay !== "target")].filter((s) => !stories.includes(s));
  return { stories, reserves, usage };
}
