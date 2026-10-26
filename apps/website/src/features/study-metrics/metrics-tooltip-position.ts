export function positionMetricsTooltip(
  anchor: { x: number; y: number },
  bounds: { width: number; height: number; top?: number },
  size: { width: number; height: number },
) {
  const gap = 12;
  const x =
    anchor.x + gap + size.width <= bounds.width - 4 ? anchor.x + gap : anchor.x - size.width - gap;
  const y =
    anchor.y + gap + size.height <= bounds.height - 4
      ? anchor.y + gap
      : anchor.y - size.height - gap;
  return {
    x: Math.max(4, Math.min(x, bounds.width - size.width - 4)),
    y: Math.max((bounds.top ?? 0) + 4, Math.min(y, bounds.height - size.height - 4)),
  };
}
