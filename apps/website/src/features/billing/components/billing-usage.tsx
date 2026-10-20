import { cn } from "@/lib/utils.ts";
import { Progress } from "@/components/ui/progress.tsx";

export const BillingUsage = ({
  className,
  indicatorClassName,
  label,
  percentage,
  value,
}: {
  className?: string;
  indicatorClassName?: string;
  label: string;
  percentage?: number;
  value: string;
}) => (
  <div className={cn("grid gap-1.5", className)}>
    <div className="flex min-w-0 items-center justify-between gap-3 text-xs">
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
    {percentage !== undefined && (
      <Progress
        aria-label={`${label}: ${value}`}
        indicatorClassName={indicatorClassName}
        value={Math.min(100, percentage)}
      />
    )}
  </div>
);
