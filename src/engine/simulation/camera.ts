/** Keep the sampling phase fixed when nearest-neighbor terrain is minified.
 * Phaser 4 disables camera.renderRoundPixels for fractional zoom, so snapping
 * world coordinates alone is insufficient: align the projected view origin.
 */
export function pixelAlignedScroll(
  scroll: number,
  viewport: number,
  world: number,
  zoom: number,
) {
  const extent = viewport / zoom;
  const offset = (extent - viewport) / 2;
  const maximum = Math.max(0, world - extent);
  const requested = scroll - offset;
  // centerOn already clamps against world bounds. Preserve that exact edge
  // even when a fractional zoom puts it between two projected pixels.
  if (requested <= 0) return offset;
  if (requested >= maximum - 1e-7) return maximum + offset;
  const origin = Math.round(requested * zoom) / zoom;
  return Math.max(0, Math.min(maximum, origin)) + offset;
}
