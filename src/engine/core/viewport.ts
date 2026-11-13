/** Bound the logical view, independently of monitor size and device pixel ratio. */
export const expandedViewport = { width: 640, height: 960 };

export function fillViewport(width: number, height: number) {
  const scale = Math.max(
    1,
    Math.floor(Math.min(width / 320, height / 180)),
    Math.ceil(width / expandedViewport.width),
    Math.ceil(height / expandedViewport.height),
  );
  return {
    width: Math.max(1, Math.ceil(width / scale)),
    height: Math.max(1, Math.ceil(height / scale)),
    scale,
  };
}
