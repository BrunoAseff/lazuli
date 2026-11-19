import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { SearchIcon } from "@/components/icons.tsx";
import { motion, useReducedMotion } from "motion/react";
import { spring } from "@/lib/motion.ts";
import { cn } from "@/lib/utils.ts";

export function Command({
  className,
  onKeyDownCapture,
  onPointerMoveCapture,
  ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
  const [keyboard, setKeyboard] = React.useState(false);
  return (
    <CommandPrimitive
      data-input={keyboard ? "keyboard" : "pointer"}
      onKeyDownCapture={(event) => {
        setKeyboard(true);
        onKeyDownCapture?.(event);
      }}
      onPointerMoveCapture={(event) => {
        setKeyboard(false);
        onPointerMoveCapture?.(event);
      }}
      className={cn(
        "group/command flex min-h-0 flex-1 flex-col overflow-hidden bg-popover text-popover-foreground",
        className,
      )}
      {...props}
    />
  );
}
export function CommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 px-3" cmdk-input-wrapper="">
      <SearchIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <CommandPrimitive.Input
        className={cn(
          "h-9 min-w-0 w-full bg-transparent text-base md:text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}
/**
 * One highlight travels to the selected result (keyboard or pointer) instead of each row
 * repainting; rows stay transparent. It is placed with layout offsets inside cmdk's sizer, so the
 * dialog's opening scale never skews it, and it scrolls with the list. When the results themselves
 * change (typing), it moves at once: only a change of selection travels.
 */
export function CommandList({
  className,
  children,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  const list = React.useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [box, setBox] = React.useState<{
    x: number;
    y: number;
    w: number;
    h: number;
    instant: boolean;
  } | null>(null);
  React.useLayoutEffect(() => {
    const node = list.current;
    if (!node) return;
    const update = (instant: boolean) => {
      const item = node.querySelector<HTMLElement>('[cmdk-item][data-selected="true"]');
      if (!item) return setBox(null);
      setBox((previous) => ({
        x: item.offsetLeft,
        y: item.offsetTop,
        w: item.offsetWidth,
        h: item.offsetHeight,
        instant: instant || !previous,
      }));
    };
    update(true);
    const mutations = new MutationObserver((records) =>
      update(records.some((record) => record.type === "childList")),
    );
    mutations.observe(node, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-selected"],
    });
    const resize = new ResizeObserver(() => update(true));
    resize.observe(node);
    return () => {
      mutations.disconnect();
      resize.disconnect();
    };
  }, []);
  return (
    <CommandPrimitive.List
      ref={list}
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain [&_[cmdk-list-sizer]]:relative",
        className,
      )}
      {...props}
    >
      {box && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 rounded-[var(--radius)] bg-primary/7"
          initial={false}
          animate={{ x: box.x, y: box.y, width: box.w, height: box.h }}
          transition={reduced || box.instant ? { duration: 0 } : spring.snap}
        />
      )}
      {children}
    </CommandPrimitive.List>
  );
}
export function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        "px-2 pb-2 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-4 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:text-sm [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
export function CommandItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "relative flex cursor-pointer items-start gap-3 rounded-[var(--radius)] px-2.5 py-2.5 text-sm outline-none select-none transition-colors duration-150 ease-[var(--ease-out)] group-data-[input=keyboard]/command:transition-none motion-reduce:transition-none data-[selected=true]:text-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      className={cn("mx-3 h-px shrink-0 bg-border/60", className)}
      {...props}
    />
  );
}
