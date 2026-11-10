import type { CSSProperties } from "react";
import type { Crop } from "./schema";

const WHOLE: Crop = { x: 0, y: 0, w: 1, h: 1 };

function intersect(a: Crop, b: Crop): Crop {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const w = Math.min(a.x + a.w, b.x + b.w) - x;
  const h = Math.min(a.y + a.h, b.y + b.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : b;
}

/**
 * Positions an image inside its frame for any frame shape. The frame zooms in as far as it can
 * while still showing the whole subject (`crop`), fills the rest with what surrounds it, and never
 * shows anything outside `bounds` or leaves empty space; when the subject can't fit, it's cut
 * evenly around its centre. The frame must be a size container (`container-type: size`): the math
 * runs in container units, so it stays exact at any frame size, resize included.
 */
export function cropStyle(image: { width: number; height: number; crop?: Crop; bounds?: Crop }): CSSProperties {
  const { width: W, height: H } = image;
  const b = image.bounds ?? WHOLE;
  const c = intersect(image.crop ?? WHOLE, b);
  const ratio = H / W;
  const fit = `min(calc(100cqw / ${c.w}), calc(100cqh / ${ratio * c.h}))`;
  const cover = `max(calc(100cqw / ${b.w}), calc(100cqh / ${ratio * b.h}))`;
  const dw = `max(${fit}, ${cover})`;
  const dh = `calc(${dw} * ${ratio})`;
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;
  return {
    width: dw,
    height: dh,
    left: `clamp(calc(100cqw - ${dw} * ${b.x + b.w}), calc(50cqw - ${dw} * ${cx}), calc(-1 * ${dw} * ${b.x}))`,
    top: `clamp(calc(100cqh - ${dh} * ${b.y + b.h}), calc(50cqh - ${dh} * ${cy}), calc(-1 * ${dh} * ${b.y}))`,
  };
}
