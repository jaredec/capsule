const warming = new Map<string, Promise<void>>();

/** Fetches and decodes an image once, so a view that shows it later paints it on its first frame. */
function warmImage(src: string): Promise<void> {
  let done = warming.get(src);
  if (!done) {
    const img = new window.Image();
    img.fetchPriority = "low";
    img.src = src;
    done = img.decode().catch(() => {});
    warming.set(src, done);
  }
  return done;
}

/** Runs `fn` once the page is idle; returns a cancel. Safari has no requestIdleCallback. */
export function whenIdle(fn: () => void): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(fn, { timeout: 2000 });
    return () => window.cancelIdleCallback(id);
  }
  const id = setTimeout(fn, 300);
  return () => clearTimeout(id);
}

/** Resolves when every image is ready, or after `timeout` ms so a slow image never holds up the page. */
export function warmImages(srcs: string[], timeout = Infinity): Promise<void> {
  const all = Promise.all(srcs.map(warmImage)).then(() => {});
  if (timeout === Infinity) return all;
  return Promise.race([all, new Promise<void>((resolve) => window.setTimeout(resolve, timeout))]);
}
