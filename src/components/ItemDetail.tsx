import { archiveDateOf, formatShortDate } from "@/lib/dates";
import { embedTarget } from "@/lib/embeds";
import type { Item } from "@/lib/schema";
import { Embed } from "./Embed";
import { CroppedImage } from "./CroppedImage";

/** Explains a featured post that went up before the day it blew up. */
function dateNote(item: Item, date: string): string | null {
  if (!item.post?.postedAt) return null;
  const posted = archiveDateOf(item.post.postedAt);
  if (posted >= date) return null;
  return `Originally posted ${formatShortDate(posted, date)}, peaked ${formatShortDate(date, posted)}.`;
}

export function ItemDetail({ item, date }: { item: Item; date: string }) {
  const target = embedTarget(item);
  const note = dateNote(item, date);
  const image = item.image && (
    <CroppedImage image={item.image} aspect={16 / 9} alt={item.title} className="w-full rounded-2xl" />
  );

  return (
    <article className="space-y-4">
      <h3 className="font-display text-3xl leading-tight text-zinc-900">{item.title}</h3>
      {target ? (
        <Embed target={target} title={item.title} />
      ) : item.sourceUrl ? (
        <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="block">
          {image}
        </a>
      ) : (
        image
      )}
      {note && <p className="text-sm text-zinc-500">{note}</p>}
    </article>
  );
}
