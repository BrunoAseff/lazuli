export const controlTransition =
  "transition-[color,background-color,border-color,opacity] duration-120 ease-out";

export const overlaySurface =
  "rounded-[var(--radius-overlay)] bg-popover text-popover-foreground shadow-[var(--shadow-overlay)] ring-1 ring-border";

export const overlayMotion =
  "duration-150 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95";

export const menuItem =
  "relative flex min-h-8 cursor-default items-center gap-2 whitespace-nowrap rounded-[calc(var(--radius)-2px)] px-2.5 py-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";
