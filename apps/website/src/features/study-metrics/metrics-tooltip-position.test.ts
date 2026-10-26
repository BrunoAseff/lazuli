import { describe, expect, it } from "vitest";
import { positionMetricsTooltip } from "./metrics-tooltip-position.ts";

describe("metrics hover tooltip position", () => {
  const bounds = { width: 600, height: 240 };
  const size = { width: 180, height: 80 };
  it("follows the hovered point instead of a fixed corner", () => {
    expect(positionMetricsTooltip({ x: 100, y: 50 }, bounds, size)).toEqual({ x: 112, y: 62 });
    expect(positionMetricsTooltip({ x: 250, y: 80 }, bounds, size)).toEqual({ x: 262, y: 92 });
  });
  it("flips left and up near the right and bottom edges", () => {
    expect(positionMetricsTooltip({ x: 580, y: 230 }, bounds, size)).toEqual({ x: 388, y: 138 });
  });
  it("clamps scrolled-out anchors and narrow containers", () => {
    expect(positionMetricsTooltip({ x: -100, y: -100 }, bounds, size)).toEqual({ x: 4, y: 4 });
    const pos = positionMetricsTooltip(
      { x: 270, y: 200 },
      { width: 278, height: 224 },
      { width: 230, height: 100 },
    );
    expect(pos.x).toBeGreaterThanOrEqual(4);
    expect(pos.x + 230).toBeLessThanOrEqual(274);
    expect(pos.y + 100).toBeLessThanOrEqual(220);
  });
  it("stays in the viewport when the graph is partly below or above it", () => {
    const lower = positionMetricsTooltip(
      { x: 200, y: 150 },
      { width: 278, height: 160, top: -640 },
      size,
    );
    expect(lower.y + size.height + 640).toBeLessThanOrEqual(796);
    const upper = positionMetricsTooltip(
      { x: 100, y: 120 },
      { width: 278, height: 900, top: 100 },
      size,
    );
    expect(upper.y - 100).toBeGreaterThanOrEqual(4);
  });
});
