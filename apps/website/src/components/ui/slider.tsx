import * as React from "react";
import { Slider as SliderPrimitive } from "radix-ui";
import { cn } from "@/lib/utils.ts";
import "./slider.css";

/**
 * A click on the track or a key press glides the knob to the new value; while the knob is being
 * dragged it follows the pointer directly, with no easing in between.
 */
export function Slider({
  className,
  onPointerDown,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const [dragging, setDragging] = React.useState(false);
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      data-dragging={dragging || undefined}
      className={cn(
        "relative flex min-h-11 w-full touch-none items-center select-none data-disabled:opacity-50",
        className,
      )}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        const start = event.clientX;
        const move = (next: PointerEvent) => {
          if (Math.abs(next.clientX - start) > 2) setDragging(true);
        };
        const end = () => {
          setDragging(false);
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", end);
          window.removeEventListener("pointercancel", end);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", end);
      }}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
        <SliderPrimitive.Range className="slider-range absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={props["aria-label"]}
        className="slider-thumb block size-4 rounded-full border border-primary/50 bg-card shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none"
      />
    </SliderPrimitive.Root>
  );
}
