import { useLayoutEffect, useState, type ReactNode } from "react";
import { ChartTooltipSurface } from "@/components/chart-tooltip.tsx";
import { positionMetricsTooltip } from "./metrics-tooltip-position.ts";

export function MetricsHoverTooltip({
  anchor,
  host,
  children,
}: {
  anchor: { x: number; y: number };
  host: HTMLElement | null;
  children: ReactNode;
}) {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [geometry, setGeometry] = useState({
    width: 0,
    height: 0,
    top: 0,
    tooltipWidth: 0,
    tooltipHeight: 0,
  });
  useLayoutEffect(() => {
    if (!element || !host) return;
    const measure = () => {
      const bounds = host.getBoundingClientRect();
      setGeometry({
        width: host.clientWidth,
        height: window.innerHeight - bounds.top,
        top: -bounds.top,
        tooltipWidth: element.offsetWidth,
        tooltipHeight: element.offsetHeight,
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    observer.observe(host);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [element, host]);
  const position = positionMetricsTooltip(anchor, geometry, {
    width: geometry.tooltipWidth,
    height: geometry.tooltipHeight,
  });
  return (
    <div
      ref={setElement}
      className="absolute left-0 top-0 w-max max-w-[calc(100%-8px)]"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        visibility: geometry.width ? "visible" : "hidden",
      }}
    >
      <ChartTooltipSurface>{children}</ChartTooltipSurface>
    </div>
  );
}
