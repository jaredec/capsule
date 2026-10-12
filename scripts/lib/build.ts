import { itemSchema, type Item } from "../../src/lib/schema";
import { choosePost, enrichStory, lookupXPost } from "./enrich";
import type { ScoredStory } from "./pick";
import type { Signals } from "./signals";

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "item"
  );
}

/** Turns picked stories into day items, attaching real article links and same-day posts. */
export async function buildItems(
  signals: Signals,
  stories: (ScoredStory & { sourceUrl?: string })[],
  collectedBy: string,
  log: (msg: string) => void = console.log,
): Promise<Item[]> {
  const byId = new Map(signals.headlines.map((h) => [h.id, h]));
  const items: Item[] = [];
  for (const story of stories) {
    const headlines = story.headlineIds.map((id) => byId.get(id)).filter((h) => h !== undefined);
    const enrichment = await enrichStory(signals.date, headlines);
    // An editor-pinned X post wins over whatever the coverage embedded, once it's confirmed to exist.
    const pinnedId = story.sourceUrl?.match(/(?:x|twitter)\.com\/\w+\/status\/(\d+)/)?.[1];
    const pinned = pinnedId ? await lookupXPost(pinnedId) : null;
    if (story.sourceUrl && !pinned) log(`    pinned sourceUrl not found: ${story.sourceUrl}`);
    if (pinned) enrichment.xPosts.unshift(pinned);
    const post = choosePost(pinned ? "x" : story.platform, enrichment);
    log(
      `  "${story.title}" pulse=${story.pulse.score} refs=${enrichment.references.length} xPosts=${enrichment.xPosts.length}` +
        (post.url ? ` post=${post.url}` : ""),
    );
    if (enrichment.references.length === 0 && !post.url) {
      log("    skipped: no resolvable source");
      continue;
    }
    const parsed = itemSchema.safeParse({
      id: `${signals.date}-${post.platform}-${slugify(story.title)}`,
      platform: post.platform,
      rank: items.length + 1,
      title: story.title.trim(),
      summary: story.summary.trim(),
      kind: story.kind,
      tags: story.tags.map(slugify).filter(Boolean).slice(0, 4),
      author: post.author,
      sourceUrl: post.url,
      ...(post.metrics ? { metrics: post.metrics } : {}),
      references: enrichment.references,
      pulse: story.pulse,
      collectedBy,
      collectedAt: new Date().toISOString(),
    });
    if (parsed.success) items.push(parsed.data);
    else log(`    skipped: ${parsed.error.message}`);
  }
  return items;
}
