import type { ReactNode } from "react";

export const DashboardSectionTitle = ({
  action,
  id,
  title,
}: {
  action?: ReactNode;
  id: string;
  title: string;
}) => (
  <header className="flex items-center justify-between gap-4">
    <div className="flex min-w-0 items-center gap-2.5">
      <h2 className="text-sm leading-snug font-semibold" id={id}>
        {title}
      </h2>
    </div>
    {action}
  </header>
);
