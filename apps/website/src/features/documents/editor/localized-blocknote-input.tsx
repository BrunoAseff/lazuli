import { CheckIcon } from "lucide-react";
import { useState, type ComponentProps } from "react";

import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { cn } from "@/lib/utils.ts";

export const LocalizedBlockNoteInput = ({
  accept,
  className,
  disabled,
  onChange,
  onSubmit,
  ref,
  type,
  ...props
}: ComponentProps<"input">) => {
  const [fileName, setFileName] = useState("");

  if (type !== "file" && onSubmit)
    return (
      <span className="flex w-full min-w-0 flex-1 items-center gap-1">
        <Input
          accept={accept}
          className={className}
          disabled={disabled}
          onChange={onChange}
          ref={ref}
          type={type}
          {...props}
        />
        <Button
          aria-label="Confirmar link"
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault();
            onSubmit(event as unknown as Parameters<NonNullable<typeof onSubmit>>[0]);
          }}
          size="icon-xs"
          type="button"
          variant="ghost"
        >
          <CheckIcon className="size-3" />
        </Button>
      </span>
    );

  if (type !== "file")
    return (
      <Input
        accept={accept}
        className={className}
        disabled={disabled}
        onChange={onChange}
        onSubmit={onSubmit}
        ref={ref}
        type={type}
        {...props}
      />
    );

  return (
    <label
      className={cn(
        "flex min-h-10 cursor-pointer items-center gap-3 rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors hover:bg-muted/60 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30",
        disabled && "pointer-events-none opacity-50",
        className,
      )}
    >
      <input
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          setFileName(event.target.files?.[0]?.name ?? "");
          onChange?.(event);
        }}
        ref={ref}
        type="file"
        {...props}
      />
      <span className="shrink-0 rounded-sm bg-secondary px-2 py-1 font-medium">
        Escolher imagem
      </span>
      <span className="min-w-0 truncate text-muted-foreground">
        {fileName || "Nenhuma imagem selecionada"}
      </span>
    </label>
  );
};
