import type { ReactNode } from "react";

export const StudySummaryMetric = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="mt-0.5 text-sm font-medium tabular-nums text-foreground">{value}</dd>
  </div>
);
