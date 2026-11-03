export const FilterCount = ({ count }: { count: number }) =>
  count > 0 ? (
    <span
      aria-hidden="true"
      className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground"
    >
      {count}
    </span>
  ) : null;
