import type { Crop } from "./schema";

const WHOLE: Crop = { x: 0, y: 0, w: 1, h: 1 };

/**
 * Positions an image inside a frame of the given aspect (width / height) so the crop region
 * fills the frame, centred on the region and never leaving empty space. Returns percentages
 * of the frame for an absolutely positioned image.
 */
export function cropStyle(
  image: { width: number; height: number; crop?: Crop },
  frameAspect: number,
): { width: string; height: string; left: string; top: string } {
  const { width: W, height: H } = image;
  const c = image.crop ?? WHOLE;
  // Frame is 1 wide and 1/frameAspect tall; s converts image pixels to frame units.
  const frameH = 1 / frameAspect;
  const s = Math.max(1 / (c.w * W), frameH / (c.h * H));
  const dw = W * s;
  const dh = H * s;
  const clamp = (v: number, min: number) => Math.min(0, Math.max(min, v));
  const left = clamp(0.5 - (c.x + c.w / 2) * W * s, 1 - dw);
  const top = clamp(frameH / 2 - (c.y + c.h / 2) * H * s, frameH - dh);
  const pct = (v: number) => `${(v * 100).toFixed(3)}%`;
  return { width: pct(dw), height: pct(dh * frameAspect), left: pct(left), top: pct(top * frameAspect) };
}
