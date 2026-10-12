import Image from "next/image";
import { embedTarget } from "@/lib/embeds";
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

function PulseMeter({ pulse }: { pulse: NonNullable<Item["pulse"]> }) {
  const parts = [
    { label: "Reach", value: pulse.reach },
    { label: "Takeover", value: pulse.dominance },
    { label: "Meme", value: pulse.memeability },
  ];
  return (
    <div className="flex items-center gap-5 rounded-2xl bg-zinc-100 px-4 py-3">
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-3xl leading-none text-zinc-900">{pulse.score.toFixed(1)}</span>
        <span className="text-[11px] uppercase tracking-wider text-zinc-500">pulse</span>
      </div>
      {parts.map((p) => (
        <div key={p.label} className="min-w-16 flex-1">
          <div className="text-[11px] text-zinc-500">{p.label}</div>
          <div className="mt-1 h-1 rounded-full bg-zinc-200">
            <div className="h-1 rounded-full bg-amber-500" style={{ width: `${p.value * 10}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ItemDetail({ item }: { item: Item }) {
  const target = embedTarget(item);
  const byline = [item.author, ...Object.entries(item.metrics ?? {}).map(([k, v]) => `${v} ${k}`)].filter(Boolean);

  return (
    <article className="space-y-4">
      {target ? (
        <Embed target={target} title={item.title} />
      ) : (
        item.image && (
          <Image
            src={item.image.src}
            width={item.image.width}
            height={item.image.height}
            alt={item.title}
            unoptimized
            className="max-h-[28rem] w-full rounded-2xl bg-zinc-100 object-cover"
          />
        )
      )}

      <div className="flex items-center gap-2">
        <PlatformBadge platform={item.platform} />
        {item.rank === 1 && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
            Pick of the day
          </span>
        )}
      </div>

      <h3 className="font-display text-3xl leading-tight text-zinc-900">{item.title}</h3>
      <p className="leading-relaxed text-zinc-600">{item.summary}</p>

      {byline.length > 0 && <p className="text-sm text-zinc-500">{byline.join(" · ")}</p>}

      {item.pulse && <PulseMeter pulse={item.pulse} />}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        {item.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-zinc-900 px-3.5 py-1.5 font-medium text-white hover:bg-zinc-700"
          >
            Open on {PLATFORM_META[item.platform].label} ↗
          </a>
        )}
        {item.references.map((ref) => (
          <a
            key={ref.url}
            href={ref.url}
            target="_blank"
            rel="noreferrer"
            title={ref.title}
            className="text-zinc-500 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-900"
          >
            {hostname(ref.url)}
          </a>
        ))}
      </div>
    </article>
  );
}
