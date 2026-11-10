import Image from "next/image";
import { mediaSrc } from "@/lib/basePath";
import { cropStyle } from "@/lib/crop";
import type { Item } from "@/lib/schema";

/**
 * Fills its box with the image, cropped around its important region. The box gets its size from
 * outside: an `aspect` with a width, or explicit sizing in `className`.
 */
export function CroppedImage({
  image,
  aspect,
  alt = "",
  className = "",
  sync = false,
}: {
  image: NonNullable<Item["image"]>;
  aspect?: number;
  alt?: string;
  className?: string;
  /** Decode before the first paint, for an image that a view transition captures the moment it mounts. */
  sync?: boolean;
}) {
  return (
    <div
      className={`overflow-hidden bg-zinc-100 [container-type:size] ${/\b(absolute|fixed)\b/.test(className) ? "" : "relative"} ${className}`}
      style={aspect ? { aspectRatio: aspect } : undefined}
    >
      <Image
        src={mediaSrc(image.src)}
        alt={alt}
        width={image.width}
        height={image.height}
        unoptimized
        // Everything Capsule shows is on screen at once; lazy loading would also stall during view transitions.
        loading="eager"
        decoding={sync ? "sync" : "async"}
        draggable={false}
        className="absolute max-w-none select-none"
        style={cropStyle(image)}
      />
    </div>
  );
}
