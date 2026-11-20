"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Tabs as TabsPrimitive } from "radix-ui";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils.ts";

// Selection continuity adapted from Arc's free Tabs/SegmentedControl (MIT, components/arc/LICENSE).
// Keep the existing Radix slots and Lazúli's page-nav versus local-view distinction.
const SelectionContext = React.createContext<{
  value?: string;
  keyboard: React.RefObject<boolean>;
}>({ keyboard: { current: false } });

function Tabs({
  className,
  orientation = "horizontal",
  value,
  defaultValue,
  onValueChange,
  onPointerDownCapture,
  onKeyDownCapture,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const keyboard = React.useRef(false);
  const [internal, setInternal] = React.useState(defaultValue);
  return (
    <SelectionContext.Provider value={{ value: value ?? internal, keyboard }}>
      <TabsPrimitive.Root
        data-slot="tabs"
        orientation={orientation}
        className={cn("group/tabs flex gap-3 data-[orientation=horizontal]:flex-col", className)}
        value={value ?? internal}
        onValueChange={(next) => {
          setInternal(next);
          onValueChange?.(next);
        }}
        onPointerDownCapture={(event) => {
          keyboard.current = false;
          onPointerDownCapture?.(event);
        }}
        onKeyDownCapture={(event) => {
          keyboard.current = true;
          onKeyDownCapture?.(event);
        }}
        {...props}
      />
    </SelectionContext.Provider>
  );
}
const tabsListVariants = cva(
  "group/tabs-list relative isolate inline-flex w-fit items-center gap-1 text-muted-foreground",
  {
    variants: { variant: { default: "rounded-lg bg-muted p-1", line: "gap-4 bg-transparent" } },
    defaultVariants: { variant: "default" },
  },
);
function TabsList({
  className,
  variant = "default",
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & VariantProps<typeof tabsListVariants>) {
  const selection = React.useContext(SelectionContext);
  const reduced = useReducedMotion();
  const list = React.useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = React.useState<{ x: number; width: number } | null>(null);
  React.useLayoutEffect(() => {
    const node = list.current;
    if (!node) return;
    const measure = () => {
      const active = node.querySelector<HTMLElement>(
        '[data-slot="tabs-trigger"][data-state="active"]',
      );
      if (!active) return;
      // Local coordinates deliberately ignore the dialog's vertical movement.
      setIndicator({ x: active.offsetLeft, width: active.offsetWidth });
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(node);
    return () => observer?.disconnect();
  }, [selection.value, children]);
  return (
    <TabsPrimitive.List
      ref={list}
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    >
      {indicator && (
        <motion.span
          aria-hidden="true"
          data-tab-indicator
          className={
            variant === "line"
              ? "pointer-events-none absolute bottom-0 left-0 -z-10 h-0.5 rounded-full bg-primary"
              : "pointer-events-none absolute inset-y-1 left-0 -z-10 rounded-md bg-card"
          }
          initial={false}
          animate={{ x: indicator.x, width: indicator.width }}
          transition={
            reduced || selection.keyboard.current
              ? { duration: 0 }
              : { type: "spring", stiffness: 700, damping: 44, mass: 0.55 }
          }
        />
      )}
      {children}
    </TabsPrimitive.List>
  );
}
function TabsTrigger({
  className,
  children,
  value,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      value={value}
      className={cn(
        "relative inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-normal whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
        "group-data-[variant=default]/tabs-list:hover:bg-card/50 group-data-[variant=default]/tabs-list:data-[state=active]:text-foreground",
        "group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:px-0 group-data-[variant=line]/tabs-list:data-[state=active]:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </TabsPrimitive.Trigger>
  );
}
function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("min-w-0 flex-1 text-sm outline-none", className)}
      {...props}
    />
  );
}
export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants };
