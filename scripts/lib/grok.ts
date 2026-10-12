import { KINDS, type Platform } from "../../src/lib/schema";

const API_URL = "https://api.x.ai/v1/responses";

export type Candidate = {
  title: string;
  summary: string;
  kind: (typeof KINDS)[number];
  tags: string[];
  author: string | null;
  sourceUrl: string | null;
  metrics: { views: string | null; likes: string | null; reposts: string | null };
  references: { title: string; url: string }[];
};

export type GrokResult = {
  candidates: Candidate[];
  citations: Set<string>;
  usage: unknown;
};

const nullableString = { type: ["string", "null"] };

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "summary", "kind", "tags", "author", "sourceUrl", "metrics", "references"],
        properties: {
          title: { type: "string", description: "Short punchy headline, max ~70 characters." },
          summary: {
            type: "string",
            description: "2-3 sentences: what it is, why it blew up, and how people riffed on it.",
          },
          kind: { type: "string", enum: [...KINDS] },
          tags: { type: "array", items: { type: "string" }, description: "1-4 lowercase topical tags." },
          author: { ...nullableString, description: "@handle of the original poster, if known." },
          sourceUrl: {
            ...nullableString,
            description: "Exact URL of the original post you retrieved with a search tool. Never guess.",
          },
          metrics: {
            type: "object",
            additionalProperties: false,
            required: ["views", "likes", "reposts"],
            properties: { views: nullableString, likes: nullableString, reposts: nullableString },
            description: "Only numbers you actually saw, formatted like 12M or 450K; otherwise null.",
          },
          references: {
            type: "array",
            description: "Up to 3 other URLs you retrieved that document this going viral.",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "url"],
              properties: { title: { type: "string" }, url: { type: "string" } },
            },
          },
        },
      },
    },
  },
};

const PLATFORM_NAMES: Record<Platform, string> = {
  x: "X (Twitter)",
  tiktok: "TikTok",
  instagram: "Instagram",
  reddit: "Reddit",
  youtube: "YouTube",
};

const PLATFORM_URL_HINT: Record<Platform, string> = {
  x: "https://x.com/<handle>/status/<id>",
  tiktok: "https://www.tiktok.com/@<handle>/video/<id>",
  instagram: "https://www.instagram.com/reel/<id>/ or https://www.instagram.com/p/<id>/",
  reddit: "https://www.reddit.com/r/<subreddit>/comments/<id>/<slug>/",
  youtube: "https://www.youtube.com/watch?v=<id> or https://www.youtube.com/shorts/<id>",
};

const SYSTEM_PROMPT = `You are the curator for Capsule, a daily archive of internet culture. For a given day you find the memes and viral moments people will look back on: viral clips, reaction images, catchphrases, absurd moments, fan edits, and sports, celebrity, or TV moments that turned into memes.

Rules:
- Only report things that actually blew up on the requested day. Use your search tools; do not rely on memory.
- Prefer genuinely meme-like, funny, or uniquely interesting content over hard news. Skip tragedies, politics-only discourse, and ads unless they clearly became a meme.
- Every URL you output must be a URL you actually retrieved with a tool. If you are unsure, use null. Never construct or guess post IDs.
- Write in a neutral, lightly witty archival voice. No emojis.`;

function userPrompt(platform: Platform, date: string, count: number): string {
  return `Date: ${date} (UTC).

What were the top ${count} memes or viral moments on ${PLATFORM_NAMES[platform]} on this day? Rank them by how much they dominated the platform that day, best first.

For each one, include the single best original post as sourceUrl in the form ${PLATFORM_URL_HINT[platform]} (the post that started it or the most-shared copy). Return JSON matching the schema.`;
}

function toolsFor(platform: Platform, date: string, nextDate: string) {
  if (platform === "x") {
    return [
      {
        type: "x_search",
        from_date: date,
        to_date: nextDate,
        enable_image_understanding: true,
      },
    ];
  }
  return [{ type: "web_search" }];
}

type ResponsesApiBody = {
  output?: { type: string; content?: { type: string; text?: string; annotations?: { url?: string }[] }[] }[];
  output_text?: string;
  citations?: (string | { url?: string })[];
  usage?: unknown;
  error?: unknown;
};

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = "";
    u.search = "";
    u.hostname = u.hostname.replace(/^(www\.|mobile\.)/, "");
    if (u.hostname === "twitter.com") u.hostname = "x.com";
    return u.toString().replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function askGrok(opts: {
  platform: Platform;
  date: string;
  nextDate: string;
  count: number;
  apiKey: string;
  model: string;
}): Promise<GrokResult> {
  const body = {
    model: opts.model,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt(opts.platform, opts.date, opts.count) },
    ],
    tools: toolsFor(opts.platform, opts.date, opts.nextDate),
    text: { format: { type: "json_schema", name: "capsule_day", schema: OUTPUT_SCHEMA, strict: true } },
    max_turns: 10,
    store: false,
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(4000 * 2 ** (attempt - 1));
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5 * 60_000),
      });
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`xAI API ${res.status}: ${await res.text()}`);
        continue;
      }
      if (!res.ok) throw new Error(`xAI API ${res.status}: ${await res.text()}`);
      return parseResponse((await res.json()) as ResponsesApiBody);
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("xAI API 4")) throw err;
      lastError = err;
    }
  }
  throw lastError;
}

function parseResponse(json: ResponsesApiBody): GrokResult {
  const citations = new Set<string>();
  for (const c of json.citations ?? []) {
    const url = typeof c === "string" ? c : c.url;
    if (url) citations.add(normalizeUrl(url));
  }

  let text = json.output_text ?? "";
  for (const item of json.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type !== "output_text") continue;
      if (!json.output_text) text += part.text ?? "";
      for (const a of part.annotations ?? []) if (a.url) citations.add(normalizeUrl(a.url));
    }
  }
  if (!text) throw new Error(`xAI response had no output text: ${JSON.stringify(json).slice(0, 500)}`);

  const parsed = JSON.parse(text) as { candidates: Candidate[] };
  return { candidates: parsed.candidates ?? [], citations, usage: json.usage };
}
