import { SearchIcon, XIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { cn } from "@/lib/utils.ts";

type SearchInputProps = Omit<ComponentProps<typeof Input>, "onChange" | "type" | "value"> & {
  containerClassName?: string;
  onClear?: () => void;
  onValueChange: (value: string) => void;
  value: string;
};

export const SearchInput = ({
  className,
  containerClassName,
  onClear,
  onValueChange,
  value,
  ...props
}: SearchInputProps) => (
  <div className={cn("relative min-w-0", containerClassName)}>
    <SearchIcon
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
    />
    <Input
      {...props}
      className={cn("pr-9 pl-9", className)}
      onChange={(event) => onValueChange(event.target.value)}
      type="text"
      value={value}
    />
    {value && (
      <Button
        aria-label="Limpar pesquisa"
        className="absolute top-1/2 right-1 -translate-y-1/2"
        onClick={onClear ?? (() => onValueChange(""))}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <XIcon aria-hidden="true" />
      </Button>
    )}
  </div>
);
