export const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/** fetch with a browser UA, a timeout, and retries on 429/5xx. Returns null on persistent failure. */
export async function fetchText(
  url: string,
  init: RequestInit & { retries?: number; timeoutMs?: number } = {},
): Promise<string | null> {
  const { retries = 2, timeoutMs = 20_000, ...rest } = init;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await sleep(2000 * 2 ** (attempt - 1));
    try {
      const res = await fetch(url, {
        ...rest,
        headers: { "User-Agent": BROWSER_UA, ...rest.headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.ok) return await res.text();
      if (res.status !== 429 && res.status < 500) return null;
    } catch {
      // retry
    }
  }
  return null;
}

export function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}
