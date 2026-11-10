import { ArrowUpRight } from "lucide-react";
import { archiveDateOf, formatShortDate } from "@/lib/dates";
import { embedTarget } from "@/lib/embeds";
import type { Item } from "@/lib/schema";
import { CroppedImage } from "./CroppedImage";
import { Embed } from "./Embed";
import { PostCard } from "./PostCard";

/** Explains a featured post that went up before the day it blew up. */
function dateNote(item: Item, date: string): string | null {
  if (!item.post?.postedAt) return null;
  const posted = archiveDateOf(item.post.postedAt);
  if (posted >= date) return null;
  return `Originally posted ${formatShortDate(posted, date)}, peaked ${formatShortDate(date, posted)}.`;
}

function Media({ item, date }: { item: Item; date: string }) {
  if (item.post) return <PostCard item={{ ...item, post: item.post }} date={date} />;
  const target = embedTarget(item);
  if (target) return <Embed target={target} title={item.title} />;
  if (!item.image) return null;
  const image = <CroppedImage image={item.image} aspect={16 / 9} alt={item.title} className="w-full rounded-2xl" />;
  return item.sourceUrl ? (
    <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="block">
      {image}
    </a>
  ) : (
    image
  );
}

export function ItemDetail({ item, date, as: Title = "h2" }: { item: Item; date: string; as?: "h1" | "h2" }) {
  const note = dateNote(item, date);

  return (
    <article>
      <Title
        className={`font-display leading-[1.1] text-balance text-zinc-900 ${
          Title === "h1" ? "text-4xl md:text-5xl" : "text-[32px]"
        }`}
      >
        {item.title}
      </Title>

      <div className="mt-5">
        <Media item={item} date={date} />
        {note && <p className="mt-3 text-sm text-zinc-500">{note}</p>}
      </div>

      <section className="mt-8">
        <h3 className="text-xs font-medium tracking-wider text-zinc-400 uppercase">What happened</h3>
        <p className="mt-2 text-[15px] leading-relaxed text-pretty text-zinc-700">{item.summary}</p>
      </section>

      {item.references.length > 0 && (
        <section className="mt-8">
          <h3 className="text-xs font-medium tracking-wider text-zinc-400 uppercase">Coverage</h3>
          <ul className="mt-2 -mx-3">
            {item.references.map((ref) => (
              <li key={ref.url}>
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-start gap-3 rounded-xl px-3 py-2 text-[15px] text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                >
                  <span className="min-w-0 flex-1">{ref.title}</span>
                  <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-zinc-400 group-hover:text-zinc-900" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
