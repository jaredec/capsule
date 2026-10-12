import { PLATFORM_META } from "@/lib/platforms";
import type { Item } from "@/lib/schema";
import { Embed } from "./Embed";

export function PlatformBadge({ platform }: { platform: Item["platform"] }) {
  const meta = PLATFORM_META[platform];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.badge}`}>
      {meta.label}
    </span>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function ItemDetail({ item, embed = true }: { item: Item; embed?: boolean }) {
  const metrics = Object.entries(item.metrics ?? {});
  return (
    <article className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PlatformBadge platform={item.platform} />
        {item.rank === 1 && (
          <span className="rounded-full border border-amber-300/40 bg-amber-300/10 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
            Pick of the day
          </span>
        )}
        <span className="text-xs uppercase tracking-wider text-zinc-500">{item.kind}</span>
      </div>

      <h3 className="font-display text-2xl leading-tight text-zinc-50">{item.title}</h3>
      <p className="leading-relaxed text-zinc-300">{item.summary}</p>

      {(item.author || metrics.length > 0) && (
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {item.author && (
            <div>
              <dt className="text-zinc-500">Posted by</dt>
              <dd className="text-zinc-200">{item.author}</dd>
            </div>
          )}
          {metrics.map(([key, value]) => (
            <div key={key}>
              <dt className="capitalize text-zinc-500">{key}</dt>
              <dd className="text-zinc-200">{value}</dd>
            </div>
          ))}
        </dl>
      )}

      {embed && <Embed item={item} />}

      <div className="flex flex-wrap gap-2">
        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-900 hover:bg-white"
          >
            Open original on {PLATFORM_META[item.platform].label} ↗
          </a>
        )}
        {item.tags.map((tag) => (
          <span key={tag} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-zinc-400">
            #{tag}
          </span>
        ))}
      </div>

      {item.references.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Coverage</h4>
          <ul className="space-y-1.5">
            {item.references.map((ref) => (
              <li key={ref.url}>
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-baseline gap-2 text-sm text-zinc-300 hover:text-zinc-50"
                >
                  <span className="underline decoration-zinc-700 underline-offset-4 group-hover:decoration-zinc-300">
                    {ref.title}
                  </span>
                  <span className="shrink-0 text-xs text-zinc-600">{hostname(ref.url)}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-zinc-600">
        Collected via {item.collectedBy} · {item.collectedAt.slice(0, 10)}
      </p>
    </article>
  );
}
