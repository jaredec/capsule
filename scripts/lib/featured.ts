import type { XPost } from "./enrich";
import { completeJson, resolveLlm } from "./llm";

const MAX_CANDIDATES = 8;

/**
 * Coverage embeds the meme itself next to posts reacting to it ("does he know he's having a
 * moment", "this is making me emotional"), and the reactions often out-like the original.
 * Asks the configured LLM which post is the moment itself and moves it to the front.
 * Without a key, or on failure, the order is left as it was.
 */
export async function preferMomentPost(
  story: { title: string; summary: string },
  posts: XPost[],
  log: (msg: string) => void = console.log,
): Promise<XPost[]> {
  const llm = resolveLlm();
  if (!llm || posts.length < 2) return posts;
  const candidates = posts.slice(0, MAX_CANDIDATES);
  const list = candidates
    .map((p, i) => {
      const media = p.videoUrl ? "video" : p.hasOwnMedia ? "photo" : "no media";
      return `${i + 1}. ${p.handle} (${p.likes.toLocaleString("en-US")} likes, ${media}): ${JSON.stringify(p.text)}`;
    })
    .join("\n");
  try {
    const { data } = await completeJson<{ post: number }>(llm, {
      system:
        "You choose the X post that represents a viral moment in an archive of internet culture. Pick the post " +
        "that IS the moment: the meme itself (an instance of the format, the joke, the image with its caption), " +
        "or the clip or photo of what happened, ideally from whoever posted it first. Do not pick posts that " +
        "comment on the trend instead of being part of it (\"X is having a moment\", \"everyone is posting this\", " +
        "\"this is making me emotional\", \"why is this everywhere\"), fan reactions, or news recaps when a post " +
        "with the thing itself is listed. Prefer English. Likes only break ties.",
      user: `Story: ${story.title}\n${story.summary}\n\nCandidate posts:\n${list}\n\nReply with the number of the post to feature.`,
      schemaName: "featured_post",
      schema: {
        type: "object",
        properties: { post: { type: "integer" } },
        required: ["post"],
        additionalProperties: false,
      },
    });
    const pick = candidates[data.post - 1];
    if (!pick) return posts;
    if (pick !== posts[0]) log(`    featured post: ${pick.url} over ${posts[0].url}`);
    return [pick, ...posts.filter((p) => p !== pick)];
  } catch (err) {
    log(`    featured post choice failed: ${err instanceof Error ? err.message : String(err)}`);
    return posts;
  }
}
