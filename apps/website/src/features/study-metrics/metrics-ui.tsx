import { STUDY_METRICS_MIN_SAMPLE } from "@lazuli/shared";
import { TickingText } from "@/components/motion/number-ticker.tsx";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button.tsx";
import { LoadError } from "@/components/empty-state.tsx";
import { formatCount, formatRate } from "./metrics-format.ts";
import { motion, useReducedMotion } from "motion/react";

export function ResultBar({
  success,
  total,
  label,
  failure = false,
}: {
  success: number;
  total: number;
  label: string;
  failure?: boolean;
}) {
  const reduced = useReducedMotion();
  const fraction = total > 0 ? Math.min(1, Math.max(0, success / total)) : 0;
  return (
    <div
      role="img"
      aria-label={`${label}: ${success} de ${total}`}
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
    >
      {total > 0 && (
        <motion.span
          className={`h-full w-full origin-left rounded-full ${failure ? "bg-destructive" : "bg-primary"}`}
          initial={false}
          animate={{ scaleX: fraction }}
          transition={{ duration: reduced ? 0 : 0.24, ease: [0.22, 1, 0.36, 1] }}
        />
      )}
    </div>
  );
}

export function MetricValue({
  label,
  value,
  previous,
  note,
}: {
  label: string;
  value: ReactNode;
  previous?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground sm:text-sm">{label}</dt>
      <dd className="mt-1 text-xl font-medium leading-none tabular-nums">
        {typeof value === "string" ? <TickingText text={value} /> : value}
      </dd>
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
      {previous !== undefined && (
        <p className="mt-2 text-xs text-muted-foreground">Antes: {previous}</p>
      )}
    </div>
  );
}
// Below the minimum sample a rate would overstate a few answers, so the count shows instead.
export const rateValue = (success: number, total: number) =>
  !total
    ? "—"
    : total < STUDY_METRICS_MIN_SAMPLE
      ? `${formatCount(success)}/${formatCount(total)}`
      : formatRate(success, total);

export function MetricsPagination({
  page,
  hasMore,
  onPage,
  label,
}: {
  page: number;
  hasMore: boolean;
  onPage: (page: number) => void;
  label: string;
}) {
  if (page === 1 && !hasMore) return null;
  return (
    <nav aria-label={label} className="flex items-center justify-between gap-2 pt-3">
      <Button
        variant="outline"
        className="min-h-11 sm:min-h-9"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
      >
        Anterior
      </Button>
      <span className="text-xs text-muted-foreground">Página {page}</span>
      <Button
        variant="outline"
        className="min-h-11 sm:min-h-9"
        disabled={!hasMore}
        onClick={() => onPage(page + 1)}
      >
        Próxima
      </Button>
    </nav>
  );
}
export function MetricsError({
  description,
  retry,
  title,
}: {
  description?: string;
  retry: () => void;
  title: string;
}) {
  return (
    <div role="alert">
      <LoadError
        compact
        description={description}
        minHeight="sm"
        onRetry={retry}
        surface="inline"
        title={title}
      />
    </div>
  );
}
