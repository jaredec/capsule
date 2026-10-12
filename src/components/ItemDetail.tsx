import { embedTarget } from "@/lib/embeds";
import type { Item } from "@/lib/schema";
import { Embed } from "./Embed";
import { CroppedImage } from "./CroppedImage";

export function ItemDetail({ item }: { item: Item }) {
  const target = embedTarget(item);
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
    </article>
  );
}
