import Image from "next/image";
import type { Item } from "@/lib/schema";

/**
 * Shows the whole image, never cropped, inside a frame of any shape; the leftover space is
 * filled with a blurred copy so every frame looks the same regardless of the image's aspect.
 */
export function FittedImage({
  image,
  alt = "",
  className = "",
}: {
  image: NonNullable<Item["image"]>;
  alt?: string;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-zinc-200 ring-1 ring-black/5 ${className}`}>
      <Image src={image.src} alt="" fill unoptimized aria-hidden className="scale-125 object-cover opacity-70 blur-xl" />
      <Image src={image.src} alt={alt} fill unoptimized className="object-contain" />
    </div>
  );
}
