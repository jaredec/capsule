import Image from "next/image";
import { cropStyle } from "@/lib/crop";
import type { Item } from "@/lib/schema";

/** Fills a frame of the given aspect with the image, cropped around its important region. */
export function CroppedImage({
  image,
  aspect,
  alt = "",
  className = "",
}: {
  image: NonNullable<Item["image"]>;
  aspect: number;
  alt?: string;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden bg-zinc-200 ${/\b(absolute|fixed)\b/.test(className) ? "" : "relative"} ${className}`}
      style={{ aspectRatio: aspect }}
    >
      <Image
        src={image.src}
        alt={alt}
        width={image.width}
        height={image.height}
        unoptimized
        className="absolute max-w-none"
        style={cropStyle(image, aspect)}
      />
    </div>
  );
}
