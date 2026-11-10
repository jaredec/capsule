import type { CSSProperties } from "react";
import type { Crop } from "./schema";

const WHOLE: Crop = { x: 0, y: 0, w: 1, h: 1 };

/**
 * Positions an image inside its frame so the crop region fills the frame, centred on the region
 * and never leaving empty space. The frame must be a size container (`container-type: size`):
 * the math runs in container units, so it stays exact at any frame size, resize included.
 */
export function cropStyle(image: { width: number; height: number; crop?: Crop }): CSSProperties {
  const { width: W, height: H } = image;
  const c = image.crop ?? WHOLE;
  const ratio = H / W;
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;
  const dw = `max(calc(100cqw / ${c.w}), calc(100cqh / ${ratio * c.h}))`;
  const dh = `calc(${dw} * ${ratio})`;
  return {
    width: dw,
    height: dh,
    left: `clamp(calc(100cqw - ${dw}), calc(50cqw - ${dw} * ${cx}), 0px)`,
    top: `clamp(calc(100cqh - ${dh}), calc(50cqh - ${dh} * ${cy}), 0px)`,
  };
}
