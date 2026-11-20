import * as React from "react";
import { Switch as ArcSwitch } from "@/components/arc/switch/switch.tsx";
import "@/components/arc/foundation.css";
import { cn } from "@/lib/utils.ts";

export function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof ArcSwitch> & { size?: "sm" | "default" }) {
  return (
    <ArcSwitch
      data-slot="switch"
      data-size={size}
      className={cn("arc-control", className)}
      {...props}
    />
  );
}
