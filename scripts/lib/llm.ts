import { sleep } from "./http";

type Provider = { baseUrl: string; model: string; keyEnv: string };

// Any OpenAI-compatible chat endpoint works; these are the cheap defaults.
const PROVIDERS: Record<string, Provider> = {
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-3.5-flash-lite",
    keyEnv: "GEMINI_API_KEY",
  },
  xai: { baseUrl: "https://api.x.ai/v1", model: "grok-4.3", keyEnv: "XAI_API_KEY" },
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-5.4-mini", keyEnv: "OPENAI_API_KEY" },
};

export type LlmConfig = { baseUrl: string; model: string; apiKey: string; label: string };

/**
 * LLM_PROVIDER picks a preset (gemini | xai | openai); LLM_BASE_URL / LLM_MODEL / LLM_API_KEY
 * override it. Without LLM_PROVIDER, the first preset whose key is set wins.
 */
export function resolveLlm(): LlmConfig | null {
  const named = process.env.LLM_PROVIDER;
  const preset = named
    ? PROVIDERS[named]
    : Object.values(PROVIDERS).find((p) => process.env[p.keyEnv]);
  const apiKey = process.env.LLM_API_KEY ?? (preset ? process.env[preset.keyEnv] : undefined);
  const baseUrl = process.env.LLM_BASE_URL ?? preset?.baseUrl;
  const model = process.env.LLM_MODEL ?? preset?.model;
  if (!apiKey || !baseUrl || !model) return null;
  return { apiKey, baseUrl: baseUrl.replace(/\/$/, ""), model, label: `${model} @ ${new URL(baseUrl).hostname}` };
}

export async function completeJson<T>(
  config: LlmConfig,
  opts: { system: string; user: string; schemaName: string; schema: object; images?: Buffer[] },
): Promise<{ data: T; usage: unknown }> {
  // Images go in as JPEG data URLs, the multimodal form every OpenAI-compatible endpoint accepts.
  const user = opts.images?.length
    ? [
        { type: "text", text: opts.user },
        ...opts.images.map((img) => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${img.toString("base64")}` } })),
      ]
    : opts.user;
  const body = {
    model: config.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: user },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: opts.schemaName, schema: opts.schema, strict: true },
    },
    temperature: 0.2,
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(4000 * 2 ** (attempt - 1));
    try {
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000),
      });
      const text = await res.text();
      if (res.status === 429 || res.status >= 500) {
        lastError = new Error(`LLM ${res.status}: ${text.slice(0, 300)}`);
        continue;
      }
      if (!res.ok) throw new Error(`LLM ${res.status}: ${text.slice(0, 500)}`);
      const json = JSON.parse(text) as { choices: { message: { content: string } }[]; usage?: unknown };
      const content = json.choices[0]?.message?.content ?? "";
      const cleaned = content.replace(/^```(?:json)?\s*|\s*```$/g, "");
      return { data: JSON.parse(cleaned) as T, usage: json.usage };
    } catch (err) {
      if (err instanceof Error && /^LLM 4\d\d/.test(err.message)) throw err;
      lastError = err;
    }
  }
  throw lastError;
}
