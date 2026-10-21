import type { ReactNode } from "react";

export const DashboardSectionTitle = ({
  action,
  icon,
  id,
  title,
}: {
  action?: ReactNode;
  icon: ReactNode;
  id: string;
  title: string;
}) => (
  <header className="flex items-start justify-between gap-4">
    <div className="flex min-w-0 items-center gap-2.5">
      <span className="shrink-0 text-primary">{icon}</span>
      <h2 className="font-heading text-2xl leading-snug font-medium" id={id}>
        {title}
      </h2>
    </div>
    {action}
  </header>
);
