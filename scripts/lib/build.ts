import { itemSchema, type Crop, type Item } from "../../src/lib/schema";
import { compactNumber, enrichStory, lookupXPost } from "./enrich";
import { attachMedia } from "./media";
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

/** Turns picked stories into X items, attaching real article links and the most-liked same-day post. */
export async function buildItems(
  signals: Signals,
  stories: (ScoredStory & { sourceUrl?: string; imageUrl?: string; crop?: Crop })[],
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
    const post = enrichment.xPosts[0] ?? null;
    log(
      `  "${story.title}" pulse=${story.pulse.score} refs=${enrichment.references.length} xPosts=${enrichment.xPosts.length}` +
        (post ? ` post=${post.url}` : ""),
    );
    if (enrichment.references.length === 0 && !post) {
      log("    skipped: no resolvable source");
      continue;
    }
    const parsed = itemSchema.safeParse({
      id: `${signals.date}-x-${slugify(story.title)}`,
      platform: "x",
      rank: items.length + 1,
      title: story.title.trim(),
      summary: story.summary.trim(),
      kind: story.kind,
      tags: story.tags.map(slugify).filter(Boolean).slice(0, 4),
      author: post?.handle,
      sourceUrl: post?.url,
      ...(post ? { metrics: { likes: compactNumber(post.likes), replies: compactNumber(post.replies) } } : {}),
      references: enrichment.references,
      pulse: story.pulse,
      collectedBy,
      collectedAt: new Date().toISOString(),
    });
    if (parsed.success) items.push(await attachMedia(signals.date, parsed.data, { log, crop: story.crop, imageUrl: story.imageUrl }));
    else log(`    skipped: ${parsed.error.message}`);
  }
  return items;
}
