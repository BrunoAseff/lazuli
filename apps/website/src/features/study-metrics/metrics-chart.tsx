import { Fragment, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Rectangle,
} from "recharts";
import { XIcon } from "@/components/icons.tsx";
import type { StudyMetricsPoint, StudyMetricsResponse, StudyMetricsView } from "@lazuli/shared";
import { ChartContainer } from "@/components/ui/chart.tsx";
import { ChartTooltipSurface, ChartTooltipValues } from "@/components/chart-tooltip.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ViewSelector } from "@/components/view-selector.tsx";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table.tsx";
import {
  formatCount,
  formatChartDate,
  formatRate,
  formatFullDate,
  metricsPlotMinWidth,
} from "./metrics-format.ts";
import { rangeLabel } from "./metrics-filters.tsx";
import { MetricsPagination } from "./metrics-ui.tsx";
import { MetricsHoverTooltip } from "./metrics-hover-tooltip.tsx";

const ratings = [
  { key: "again", label: "Repetir", color: "var(--destructive)" },
  { key: "hard", label: "Difícil", color: "var(--warning)" },
  { key: "good", label: "Bom", color: "var(--primary)" },
  { key: "easy", label: "Fácil", color: "var(--success)" },
] as const;
type Kind = "activity" | "accuracy" | "ratings" | "answers";
const titles: Record<Kind, string> = {
  activity: "Sua prática",
  accuracy: "Acertos ao longo do tempo",
  ratings: "Como você avaliou",
  answers: "Suas respostas",
};
const seriesFor = (kind: Kind) =>
  kind === "ratings"
    ? [...ratings]
    : kind === "activity"
      ? [
          { key: "evaluations", label: "Revisões de flashcards", color: "var(--primary)" },
          { key: "quizAnswers", label: "Respostas de quizzes", color: "var(--chart-3)" },
        ]
      : kind === "answers"
        ? [
            { key: "quizCorrect", label: "Acertos", color: "var(--success)" },
            { key: "errors", label: "Erros", color: "var(--destructive)" },
          ]
        : [{ key: "rate", label: "Acertos", color: "var(--primary)" }];
const values = (p: StudyMetricsPoint) => ({
  ...p,
  errors: p.quizAnswers - p.quizCorrect,
  rate: p.quizAnswers ? (100 * p.quizCorrect) / p.quizAnswers : null,
});

export function MetricsChart({
  data,
  view,
}: {
  data: StudyMetricsResponse;
  view: StudyMetricsView;
}) {
  const [params, setParams] = useSearchParams();
  const kind: Kind =
    view === "overview"
      ? "activity"
      : view === "flashcards"
        ? "ratings"
        : params.get(`${view}Metric`) === "answers"
          ? "answers"
          : "accuracy";
  const table = params.get(`${view}Display`) === "table";
  const [pinned, setPinned] = useState<number | null>(null);
  const [chart, setChart] = useState<HTMLDivElement | null>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  useEffect(() => setPinned(null), [data.from, data.to, view, kind]);
  const series = seriesFor(kind),
    rate = kind === "accuracy";
  const hasPreviousBars = data.previousSeries?.some((point) =>
    series.some((s) => Number(values(point)[s.key as keyof ReturnType<typeof values>]) > 0),
  );
  const rows = data.series.map((p, index) => ({
    ...values(p),
    index,
    ...Object.fromEntries(
      data.previousSeries?.[index]
        ? Object.entries(values(data.previousSeries[index]!)).map(([k, v]) => [`previous_${k}`, v])
        : [],
    ),
  }));
  const requestedPage = Number(params.get(`${view}TablePage`) ?? 1);
  const page = Math.min(
    Math.max(1, Math.ceil(rows.length / 10)),
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
  );
  const change = (name: string, value: string) => {
    setPinned(null);
    setParams(
      (p) => {
        p.set(`${view}${name}`, value);
        if (name !== "TablePage") p.delete(`${view}TablePage`);
        return p;
      },
      { replace: true },
    );
  };
  const previousLabel =
    data.previousFrom && data.previousTo ? rangeLabel(data.previousFrom, data.previousTo) : null;
  const currentLabel = rangeLabel(data.from, data.to);
  const showYears =
    data.from.slice(0, 4) !== data.to.slice(0, 4) ||
    (data.previousFrom && data.previousFrom.slice(0, 4) !== data.from.slice(0, 4));
  const pointLabel = (point: StudyMetricsPoint) =>
    showYears
      ? point.date === point.end
        ? formatFullDate(point.date)
        : `${formatFullDate(point.date)} – ${formatFullDate(point.end)}`
      : rangeLabel(point.date, point.end);
  const items = (point: StudyMetricsPoint) => {
    const p = values(point);
    return rate
      ? [
          {
            label: "Acertos",
            value: point.quizAnswers ? formatRate(point.quizCorrect, point.quizAnswers) : "—",
            color: "var(--primary)",
          },
          {
            label: "Respostas corretas",
            value: `${formatCount(point.quizCorrect)} de ${formatCount(point.quizAnswers)}`,
          },
        ]
      : series.map((s) => ({
          label: s.label,
          value: formatCount(Number(p[s.key as keyof typeof p])),
          color: s.color,
        }));
  };
  const detail = (index: number) => (
    <div className="space-y-3">
      <ChartTooltipValues
        title={pointLabel(data.series[index]!)}
        items={items(data.series[index]!)}
      />
      {data.previousSeries?.[index] && (
        <div className="border-t border-border/50 pt-2">
          <ChartTooltipValues
            title={pointLabel(data.previousSeries[index]!)}
            items={items(data.previousSeries[index]!)}
          />
        </div>
      )}
    </div>
  );
  const selectPoint = (state: { activeTooltipIndex?: number | string | null }) => {
    const index = Number(state.activeTooltipIndex);
    if (
      state.activeTooltipIndex != null &&
      Number.isInteger(index) &&
      index >= 0 &&
      index < rows.length
    )
      setPinned(index);
  };
  const axisLabel = (date: string) => formatChartDate(date, data.bucket);
  const axis = (
    <>
      <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.35} />
      <XAxis
        dataKey="date"
        type="category"
        tickLine={false}
        axisLine={false}
        interval={0}
        height={data.bucket === "month" ? 30 : 44}
        tick={({ x, y, payload }) => (
          <text
            x={x}
            y={y}
            textAnchor="middle"
            fill="var(--muted-foreground)"
            fontSize={12}
            data-metrics-tick={payload.value}
          >
            {axisLabel(String(payload.value))
              .split("\n")
              .map((line, index) => (
                <tspan key={index} x={x} dy={index ? 14 : 4}>
                  {line}
                </tspan>
              ))}
          </text>
        )}
        tickMargin={10}
        padding={rate ? { left: 16, right: 16 } : undefined}
      />
      <YAxis
        // Wide enough for "100%"; counts stay compact.
        width={rate ? 44 : 36}
        domain={rate ? [0, 100] : [0, "auto"]}
        tickFormatter={(v) => (rate ? `${v}%` : formatCount(Number(v)))}
        allowDecimals={false}
        tickLine={false}
        axisLine={false}
      />
    </>
  );
  const tooltip = (
    <Tooltip
      portal={chart}
      active={pinned === null ? undefined : false}
      cursor={false}
      wrapperStyle={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 20,
      }}
      content={({ active, payload, coordinate }) => {
        const index = payload?.[0]?.payload?.index as number | undefined;
        return active && index !== undefined ? (
          <MetricsHoverTooltip
            host={chart}
            anchor={{ x: (coordinate?.x ?? 0) - scrollLeft, y: coordinate?.y ?? 0 }}
          >
            {detail(index)}
          </MetricsHoverTooltip>
        ) : null;
      }}
    />
  );
  const columns = rate
    ? [
        { key: "rate", label: "Acertos" },
        { key: "correct", label: "Respostas corretas" },
      ]
    : series;
  const columnMaxima = Object.fromEntries(
    columns.map(({ key }) => [
      key,
      Math.max(
        1,
        ...[...data.series, ...(data.previousSeries ?? [])].map(
          (point) => Number(values(point)[key as keyof ReturnType<typeof values>]) || 0,
        ),
      ),
    ]),
  );
  const cell = (point: StudyMetricsPoint, key: string) =>
    key === "correct"
      ? `${formatCount(point.quizCorrect)} / ${formatCount(point.quizAnswers)}`
      : key === "rate"
        ? point.quizAnswers
          ? formatRate(point.quizCorrect, point.quizAnswers)
          : "—"
        : formatCount(Number(values(point)[key as keyof ReturnType<typeof values>]));
  const tableRows = data.series.slice((page - 1) * 10, page * 10).flatMap((point, offset) => {
    const previous = data.previousSeries?.[(page - 1) * 10 + offset];
    return [{ point, previous: false }, ...(previous ? [{ point: previous, previous: true }] : [])];
  });
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-sm leading-snug font-semibold">{titles[kind]}</h2>
          <span className="text-xs text-muted-foreground">
            {data.bucket === "day" ? "Por dia" : data.bucket === "week" ? "Por semana" : "Por mês"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {view === "quizzes" && (
            <Select value={kind} onValueChange={(v) => change("Metric", v)}>
              <SelectTrigger
                aria-label="Agrupar por"
                className="min-h-11 w-auto border-border sm:min-h-9"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Agrupar por</SelectLabel>
                  <SelectItem value="accuracy">Acertos</SelectItem>
                  <SelectItem value="answers">Respostas</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
          <ViewSelector
            label="Visualização dos dados"
            value={table ? "table" : "chart"}
            onChange={(v) => change("Display", v)}
            options={[
              { value: "chart", label: "Gráfico" },
              { value: "table", label: "Tabela" },
            ]}
          />
        </div>
      </div>
      {!rate && !table && (
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      {previousLabel && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="w-4 border-t-2 border-primary" />
            {currentLabel}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-4 border-t-2 border-dashed border-muted-foreground" />
            {data.previous && data.previous.evaluations + data.previous.quizAnswers === 0
              ? "Sem histórico anterior"
              : previousLabel}
          </span>
        </div>
      )}
      {table ? (
        <div>
          <div className="rounded-lg border border-border/50 sm:max-h-96 sm:overflow-y-auto">
            <div className="divide-y divide-border/50 sm:hidden">
              {tableRows.map(({ point, previous }) => (
                <div
                  key={`${previous}-${point.date}`}
                  className={`p-3 ${previous ? "bg-muted/25" : ""}`}
                >
                  <p className="mb-3 text-sm font-medium">
                    {previousLabel && (
                      <span className="mr-2 text-xs text-muted-foreground">
                        {previous ? "Anterior" : "Atual"}
                      </span>
                    )}
                    {pointLabel(point)}
                  </p>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {columns.map((c) => (
                      <div key={c.key}>
                        <dt className="text-xs text-muted-foreground">{c.label}</dt>
                        <dd className="mt-1 text-sm font-medium tabular-nums">
                          {cell(point, c.key)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>
            <div className="hidden sm:block">
              <Table aria-label={`Dados de ${titles[kind].toLowerCase()}`}>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead className="px-4 py-3 text-xs text-muted-foreground">
                      Período
                    </TableHead>
                    {columns.map((c) => (
                      <TableHead
                        key={c.key}
                        className="px-4 py-3 text-right text-xs whitespace-normal text-muted-foreground"
                      >
                        {c.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableRows.map(({ point, previous }) => (
                    <TableRow
                      key={`${previous}-${point.date}`}
                      className={previous ? "bg-muted/25" : ""}
                    >
                      <TableCell className="px-4 py-4 text-sm whitespace-normal">
                        {previousLabel && (
                          <span className="mb-1 block text-xs text-muted-foreground">
                            {previous ? "Anterior" : "Atual"}
                          </span>
                        )}
                        {pointLabel(point)}
                      </TableCell>
                      {columns.map((c) => (
                        <TableCell
                          key={c.key}
                          className={`px-4 py-4 text-right text-sm font-medium tabular-nums ${cell(point, c.key) === "0" ? "text-muted-foreground/70" : ""}`}
                        >
                          <div className="flex items-center justify-end gap-3">
                            {!rate && (
                              <span
                                aria-hidden="true"
                                className="relative hidden h-1.5 w-20 overflow-hidden rounded-full bg-muted sm:block lg:w-28"
                              >
                                <span
                                  className="absolute inset-0 origin-left rounded-full transition-transform duration-200 motion-reduce:transition-none"
                                  style={{
                                    background: series.find(({ key }) => key === c.key)?.color,
                                    transform: `scaleX(${Number(values(point)[c.key as keyof ReturnType<typeof values>]) / columnMaxima[c.key]!})`,
                                    opacity: previous ? 0.45 : 0.8,
                                  }}
                                />
                              </span>
                            )}
                            <span className="min-w-5">{cell(point, c.key)}</span>
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <MetricsPagination
            page={page}
            hasMore={page * 10 < rows.length}
            onPage={(v) => change("TablePage", String(v))}
            label="Páginas dos dados do gráfico"
          />
        </div>
      ) : (
        <div
          ref={setChart}
          className="relative"
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key.startsWith("Arrow")) setPinned(null);
          }}
        >
          <div
            className="overflow-x-auto overscroll-x-contain rounded pb-1 focus-visible:outline-2 focus-visible:outline-ring"
            role="region"
            aria-label="Gráfico de estudo, role horizontalmente quando necessário"
            tabIndex={0}
            onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
          >
            <div style={{ minWidth: metricsPlotMinWidth(rows.length) }}>
              <ChartContainer className="h-56 sm:h-60 [&_.recharts-surface:focus:not(:focus-visible)]:outline-none [&_.recharts-surface:focus-visible]:outline-2 [&_.recharts-surface:focus-visible]:outline-ring">
                {rate ? (
                  <LineChart
                    accessibilityLayer
                    aria-label={titles[kind]}
                    data={rows}
                    onClick={selectPoint}
                    margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                  >
                    {axis}
                    {tooltip}
                    <Line
                      dataKey="rate"
                      name="Acertos"
                      type="linear"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                    {previousLabel && (
                      <Line
                        dataKey="previous_rate"
                        name="Anterior"
                        type="linear"
                        stroke="var(--muted-foreground)"
                        strokeDasharray="5 4"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls={false}
                        isAnimationActive={false}
                      />
                    )}
                  </LineChart>
                ) : (
                  <BarChart
                    accessibilityLayer
                    aria-label={titles[kind]}
                    data={rows}
                    onClick={selectPoint}
                    barCategoryGap="25%"
                    maxBarSize={56}
                    margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
                  >
                    {axis}
                    {tooltip}
                    {[false, ...(previousLabel && hasPreviousBars ? [true] : [])].map(
                      (previous) => (
                        <Fragment key={String(previous)}>
                          {series.map((s) => {
                            const key = `${previous ? "previous_" : ""}${s.key}`;
                            return (
                              <Bar
                                key={key}
                                dataKey={key}
                                name={`${previous ? "Anterior: " : ""}${s.label}`}
                                fill={s.color}
                                fillOpacity={previous ? 0.3 : 1}
                                stroke={previous ? s.color : undefined}
                                strokeDasharray={previous ? "3 2" : undefined}
                                stackId={
                                  kind === "activity"
                                    ? undefined
                                    : previous
                                      ? "previous"
                                      : "current"
                                }
                                shape={(props) => {
                                  const payload = props.payload as Record<string, number>;
                                  const top =
                                    kind === "activity"
                                      ? undefined
                                      : series.findLast(
                                          (item) =>
                                            Number(
                                              payload[`${previous ? "previous_" : ""}${item.key}`],
                                            ) > 0,
                                        )?.key;
                                  return (
                                    <Rectangle
                                      {...props}
                                      data-metrics-category={String(payload.date)}
                                      data-metrics-period={previous ? "previous" : "current"}
                                      radius={!top || top === s.key ? [6, 6, 0, 0] : 0}
                                    />
                                  );
                                }}
                                activeBar={false}
                                isAnimationActive={false}
                              />
                            );
                          })}
                        </Fragment>
                      ),
                    )}
                  </BarChart>
                )}
              </ChartContainer>
            </div>
          </div>
          {pinned !== null && data.series[pinned] && (
            <ChartTooltipSurface
              className={`absolute top-1 z-10 max-h-56 w-[min(20rem,calc(100%-0.5rem))] overflow-y-auto pr-12 ${pinned < rows.length / 2 ? "right-1" : "left-1"}`}
            >
              <div aria-live="polite">{detail(pinned)}</div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1"
                aria-label="Fechar detalhe"
                onClick={() => {
                  setPinned(null);
                  chart?.querySelector<SVGElement>("[role=application]")?.focus();
                }}
              >
                <XIcon />
              </Button>
            </ChartTooltipSurface>
          )}
        </div>
      )}
    </div>
  );
}
