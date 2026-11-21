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
  /** Optional so picks files written before the rubric had them still load. */
  novelty?: number;
  dull?: boolean;
  platform: Platform;
  peakDay: "target" | "previous" | "next";
  headlineIds: number[];
  why: string;
};

export type ScoredStory = Story & { pulse: Pulse };

const NICHE_CATEGORIES = new Set<Pulse["category"]>(["sports", "tech", "politics", "news"]);

/** An event nearly the whole country watched or talked about (a Super Bowl, a historic title) has crossed over by size alone. */
const everyoneSaw = (s: { reach: number; dominance: number }) => s.reach >= 9 && s.dominance >= 9;

/**
 * Deterministic final score so the ranking rule is explicit and tunable, rather than
 * buried in the model's ordering. The score is about discussion: how many people saw it and how
 * hard it took over the day. Sports/tech/politics/news only compete at full strength when they
 * crossed over, as a meme or by sheer size. Politics gets boosted by partisan accounts without
 * reaching normal people, so it also needs near-total reach.
 */
export function scoreStory(s: Pick<Story, "reach" | "dominance" | "memeability" | "category" | "crossover">): number {
  const base = 0.45 * s.reach + 0.45 * s.dominance + 0.1 * s.memeability;
  const penalty =
    s.category === "politics"
      ? s.crossover && s.reach >= 9 ? 0.9 : 0.4
      : NICHE_CATEGORIES.has(s.category) ? (s.crossover || everyoneSaw(s) ? 0.9 : 0.55) : 1;
  return Math.round(base * penalty * 10) / 10;
}

/** A story that isn't dull and scores at least this is a real moment, and goes before any dull story that day. */
export const STANDOUT_FLOOR = 5;

/** Dull stories (predictable and little discussed) are for slow days: they lead only when no real moment cleared the floor. */
export const isStandout = (s: { dull?: boolean; pulse: Pick<Pulse, "score"> }) =>
  !s.dull && s.pulse.score >= STANDOUT_FLOOR;

/**
 * Bigger first. Novelty only settles stories of about the same size (within the same half point),
 * so a memorable small story never passes a big one.
 */
export function byPulse(a: { novelty?: number; pulse: Pick<Pulse, "score"> }, b: { novelty?: number; pulse: Pick<Pulse, "score"> }): number {
  const bucket = (n: number) => Math.round(n * 2);
  return (
    bucket(b.pulse.score) - bucket(a.pulse.score) ||
    (b.novelty ?? 5) - (a.novelty ?? 5) ||
    b.pulse.score - a.pulse.score
  );
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
          "memeability", "novelty", "dull", "platform", "peakDay", "headlineIds", "why",
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
          novelty: score1to10,
          dull: { type: "boolean" },
          platform: { type: "string", enum: [...PLATFORMS] },
          peakDay: { type: "string", enum: ["target", "previous", "next"] },
          headlineIds: { type: "array", items: { type: "integer" } },
          why: { type: "string" },
        },
      },
    },
  },
};

const SYSTEM = `You are the editor of Capsule, an archive of the internet's daily pulse. For each day you pick what controlled the feed in the US and Canada: the thing a normal person (not a terminally online one) would have seen reposted, heard coworkers mention, or had explained to them by a friend, and would still say "oh, I remember that" about later. Size comes first: the pick is what people were actually talking about that day.

Scoring, each 1-10:
- reach: did it escape its niche and reach "normies"? 10 = your aunt saw it.
- dominance: how hard did it take over feeds that day? Mass reposts, quote-posts, duets, stitches, "everyone is talking about", many outlets covering the reaction itself.
- memeability: did it spawn remixes, templates, catchphrases, reaction images, parodies?

Calibrate reach and dominance against these anchors, and use the whole range:
- 10: the entire country at once. A Super Bowl, a presidential election night, the death of someone everyone knows. A few days a year.
- 8-9: the clear top story of the day; most feeds showed it and people who never post about the subject were posting about it. Not every day has one.
- 6-7: big inside one community (a fandom, a sport, tech, politics) with some spillover. This is where a typical day's best story lands.
- 4-5: a popular post or a clever follow-up that got passed around but that most people never saw.
- 1-3: niche.
Most days should top out at 6-8. Your five candidates must not share the same scores: rank them against each other first, then score. In "why", name the evidence of size (how many outlets covered the reaction, trending searches, a Wikipedia breakout) rather than asserting it. Press coverage can raise a score, but few or no headlines must never lower one: headlines are not a measure of discussion on X, and you cannot see X, so you do not know how big something was there. crossover is false by default; set it true only when you can point to people outside that world reposting it.

- novelty: is it one of a kind and could it only belong to this day? This only breaks ties between stories of similar size; never use it to lift a small story over a big one. A follow-up to an older meme that few people saw is small, however clever it is.

Also set dull=true when a story was both predictable and little discussed: a trailer, an injury report, an award or result with nothing notable in it, a routine launch or appointment. Dull is about the reaction, not the topic: a death, a verdict, a game, a joke on a weekly show or an anniversary is NOT dull if it took over the feed. A first-ever title, a huge event (a Super Bowl, an election night) and anyone saying or doing something wild are never dull.

Editorial rules:
- Prefer memes, pure internet absurdity, everyday-life drama, animals, food, brands, and pop culture moments people riffed on.
- A celebrity story only counts when the celebrity became the joke or did something memeable that non-fans reposted for the laugh (a coach revealing a 12-year Minecraft city, an actor's old photo turned into a caption template, a comedian's skit). Fan-account content is NOT the pulse: red carpets, outfits, lip-syncs, thirst clips, cute candids, cast reunions, trailers, interviews, "X did Y and fans are losing it". For those set memeability and reach low.
- Sports, tech/AI, business, and politics are normally NOT the pulse. Only set crossover=true when the moment became an instant meme shared by people who don't follow that world (e.g. a clip non-fans reposted for the joke, not for the game).
- Politics almost never qualifies: political clips get boosted by partisan accounts and outlets without reaching normal people. This covers politicians, their families, and anyone who is only in the news because of a political event (an Oval Office guest, a rally moment). Only a mega-viral meme that everyone saw and remixed regardless of their politics counts, on the scale of the Marco Rubio couch meme; then set category=politics, crossover=true and reach 9 or 10. An awkward rally moment, a gaffe or a guest's odd appearance does not qualify.
- Dull stories are for slow days: any real moment from the day goes ahead of them, and they lead only when nothing else was being talked about. Still return the strongest one as a candidate so a slow day has a fallback.
- No subject is off limits. Crime, trials, tragedies, deaths and politics are all eligible when they led the conversation; judge them by how much discussion they drove, like anything else.
- When a big event leads the day, write the story about the moment from it people will remember (the play, the quote, the image), and name the event in the title.
- North America only: what matters is who was discussing it, not where it happened. A UK or French event that people in the US and Canada were talking about counts. Huge numbers from audiences elsewhere (cricket, K-pop fandoms, Bollywood, European football) do not count unless US or Canadian outlets or accounts picked the story up.
- Skip recycled engagement bait that resurfaces every few months (then-vs-now comparisons, "remember this", nostalgia screenshots). A day's pick should be tied to that day: something that happened, was posted, or newly took off then.
- The story must have peaked on the target date (a US Pacific-time day). Headlines from the following day often recap the target day; use peakDay to say when it actually peaked.
- Merge headlines about the same thing into one story and list all their ids in headlineIds (most informative first). Only cite ids from the list.
- Do not repeat stories already picked on recent days.
- Write the title as a short punchy archival headline (max ~70 chars) and the summary in 1-2 short sentences (under ~40 words): what happened and the gist of how people reacted. No like or view counts, no emojis, no hype words like "breaks the internet".`;

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
 * Candidates in the order to try them: those that peaked on the target day, then the rest, so a
 * day is never left empty when nothing peaked that day. Within each, real moments by size come
 * before dull stories.
 */
export async function pickStories(
  llm: LlmConfig,
  signals: Signals,
  opts: { recentTitles: string[] },
): Promise<{ candidates: ScoredStory[]; usage: unknown }> {
  const user = `${formatSignals(signals, opts.recentTitles)}

Return the 5 strongest candidates for this day's pulse, strongest first.`;
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
        novelty: s.novelty,
        dull: s.dull,
        category: s.category,
        crossover: s.crossover,
      },
    }))
    .sort(byPulse);
  // Within each group real moments come before dull stories, whatever the dull story scored.
  const ordered = (group: ScoredStory[]) => [...group.filter(isStandout), ...group.filter((s) => !isStandout(s))];
  return {
    candidates: [
      ...ordered(candidates.filter((s) => s.peakDay === "target")),
      ...ordered(candidates.filter((s) => s.peakDay !== "target")),
    ],
    usage,
  };
}
