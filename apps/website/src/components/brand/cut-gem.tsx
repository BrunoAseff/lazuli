import { cn } from "@/lib/utils.ts";

/*
 * A lapis being cut. At 0 it is a rough, lumpy stone of one dull colour; as `cut` grows the outline
 * straightens into the brand gem, the facets catch light, the table forms, and at the end the
 * pyrite fleck appears. `dull` (0–1) takes the shine away: neglected stones lose their polish.
 *
 * Geometry: eight points around the outline (corners and edge midpoints), interpolated from a
 * hand-placed rough stone to the cut gem of GemMark (scaled to 64).
 */
type Point = [number, number];

// Twelve points clockwise from the top: the four corners (0, 3, 6, 9) and two points on each edge.
// The rough stone is a lumpy rock; the cut outline puts every point on the gem's straight edges.
const roughOutline: Point[] = [
  [30, 10],
  [40, 8],
  [50, 15],
  [56, 27],
  [54, 40],
  [46, 50],
  [34, 56],
  [22, 53],
  [11, 45],
  [7, 33],
  [10, 21],
  [19, 12],
];
const cutOutline: Point[] = [
  [32, 4],
  [41.33, 13.33],
  [50.67, 22.67],
  [60, 32],
  [50.67, 41.33],
  [41.33, 50.67],
  [32, 60],
  [22.67, 50.67],
  [13.33, 41.33],
  [4, 32],
  [13.33, 22.67],
  [22.67, 13.33],
];
const table: Point[] = [
  [32, 19.2],
  [44.8, 32],
  [32, 44.8],
  [19.2, 32],
];

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (edge0: number, edge1: number, value: number) => {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};
const path = (points: Point[]) =>
  `M${points.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L")}Z`;

/** The named stages, so the picture always comes with words. */
export const gemStage = (cut: number) =>
  cut >= 1
    ? "Polida"
    : cut >= 0.75
      ? "Lapidada"
      : cut >= 0.5
        ? "Facetada"
        : cut >= 0.25
          ? "Desbastada"
          : "Bruta";

export const CutGem = ({
  cut,
  dull = 0,
  size = 72,
  className,
}: {
  cut: number;
  dull?: number;
  size?: number;
  className?: string;
}) => {
  const t = Math.min(1, Math.max(0, cut));
  const outline = roughOutline.map(
    ([x, y], index) =>
      [mix(x, cutOutline[index]![0], t), mix(y, cutOutline[index]![1], t)] as Point,
  );
  const top = outline[0]!;
  const right = outline[3]!;
  const bottom = outline[6]!;
  const left = outline[9]!;
  // The rock's volume (a lit chip, a shaded side) fades as the first flat cuts appear; facets
  // take over by half way, the table forms after, and polish (shine, fleck) only at the end.
  const rock = 1 - ease(0.05, 0.55, t);
  const facets = ease(0.1, 0.5, t);
  const tableShown = ease(0.4, 0.8, t);
  const polish = ease(0.88, 1, t);
  const tablePoints = table.map(
    ([x, y]) => [mix(32, x, tableShown), mix(32, y, tableShown)] as Point,
  );
  const [tTop, tRight, tBottom, tLeft] = tablePoints as [Point, Point, Point, Point];
  return (
    <svg
      aria-hidden="true"
      className={cn("shrink-0 overflow-visible transition-[filter] duration-500", className)}
      height={size}
      style={{
        filter: dull ? `saturate(${1 - 0.7 * dull}) brightness(${1 - 0.12 * dull})` : undefined,
      }}
      viewBox="0 0 64 64"
      width={size}
    >
      {/* Rough body: a matte rock with a lit chip and a shaded side. */}
      <path d={path(outline)} fill="var(--gem-rough)" />
      <g opacity={rock}>
        <path
          d={path([
            outline[9]!,
            outline[10]!,
            outline[11]!,
            outline[0]!,
            outline[1]!,
            [30, 24],
            [17, 31],
          ])}
          fill="var(--gem-rough-light)"
        />
        <path
          d={path([outline[3]!, outline[4]!, outline[5]!, outline[6]!, [36, 42], [47, 31]])}
          fill="var(--gem-rough-dark)"
        />
      </g>
      <g opacity={facets}>
        <path d={path([left, top, tTop, tLeft])} fill="var(--facet-1)" />
        <path d={path([top, right, tRight, tTop])} fill="var(--facet-2)" />
        <path d={path([right, bottom, tBottom, tRight])} fill="var(--facet-3)" />
        <path d={path([bottom, left, tLeft, tBottom])} fill="var(--facet-4)" />
        <path d={path(tablePoints)} fill="var(--facet-table)" opacity={tableShown} />
      </g>
      {/* Polished: light runs along the upper-left edge and the pyrite fleck shows on the table. */}
      {polish > 0 && (
        <g opacity={polish}>
          <path d="M8 32 L32 8 L35 11 L11 35Z" fill="white" opacity={0.35} />
          <path className="cut-gem-fleck" d="M39 21 43 25 39 29 35 25Z" fill="var(--gold)" />
        </g>
      )}
    </svg>
  );
};
