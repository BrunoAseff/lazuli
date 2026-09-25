import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";

export const AuthSubmitButton = ({ className, ...props }: ComponentProps<typeof Button>) => (
  <Button className={cn("h-11 w-full", className)} {...props} />
);
