import * as React from "react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils.ts";

export function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-2", className)}
      {...props}
    />
  );
}
export function RadioGroupItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "grid size-4 shrink-0 place-items-center rounded-full border border-input bg-card outline-none transition-[background-color,border-color] duration-150 focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50 data-[state=checked]:border-action data-[state=checked]:bg-action",
        className,
      )}
      {...props}
    >
      {children ?? (
        <RadioGroupPrimitive.Indicator className="radio-dot size-1.5 rounded-full bg-action-foreground" />
      )}
    </RadioGroupPrimitive.Item>
  );
}

/**
 * One option the person picks among a few: the whole card is the target, the radio states the choice.
 * "row" for a list of short labels; "tile" for a few options with an icon and a description.
 */
export function RadioCard({
  className,
  description,
  icon,
  layout = "row",
  title,
  value,
  disabled,
}: {
  className?: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  layout?: "row" | "tile";
  title: React.ReactNode;
  value: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("radio-card", className)} data-layout={layout}>
      {layout === "tile" && icon && <span className="radio-card-icon">{icon}</span>}
      <RadioGroupItem className="radio-card-control" disabled={disabled} value={value} />
      <span className="radio-card-text">
        <span className="radio-card-title">
          <span className="radio-card-ink">{title}</span>
        </span>
        {description && <span className="radio-card-description">{description}</span>}
      </span>
    </label>
  );
}
