import type { ReactNode } from "react";
import { Button } from "@/components/ui/button.tsx";
import { formatCount, formatRate } from "./metrics-format.ts";

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
  return (
    <div
      role="img"
      aria-label={`${label}: ${success} de ${total}`}
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-muted"
    >
      {total > 0 && (
        <span
          className={`h-full ${failure ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${(100 * success) / total}%` }}
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
      <dd className="mt-1 text-2xl font-medium leading-none tabular-nums">{value}</dd>
      {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
      {previous !== undefined && (
        <p className="mt-2 text-xs text-muted-foreground">Antes: {previous}</p>
      )}
    </div>
  );
}
export const rateValue = (success: number, total: number) =>
  !total
    ? "—"
    : total < 20
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
export function MetricsError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div role="alert" className="space-y-3 py-5 text-sm">
      <p>{message}</p>
      <Button variant="outline" className="max-sm:min-h-11" onClick={retry}>
        Tentar novamente
      </Button>
    </div>
  );
}
