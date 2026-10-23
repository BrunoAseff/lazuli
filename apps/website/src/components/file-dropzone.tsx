import { PlusIcon, ReplaceIcon, UploadCloudIcon } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button.tsx";
import { useIsMobile } from "@/hooks/use-mobile.ts";
import { cn } from "@/lib/utils.ts";

export function FileDropzone({
  accept,
  multiple = false,
  disabled = false,
  onFiles,
  children,
  buttonLabel,
  replacing = false,
}: {
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  children?: ReactNode;
  buttonLabel?: string;
  replacing?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const mobile = useIsMobile();
  return (
    <div
      className={cn(
        "grid min-h-28 place-items-center rounded-xl border border-dashed p-4 text-center transition-colors sm:min-h-36 sm:p-5",
        !disabled && "hover:border-primary/55 hover:bg-primary-soft/45",
        dragging && "border-foreground bg-muted/50",
        disabled && "opacity-50",
      )}
      onDragEnter={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) onFiles(Array.from(event.dataTransfer.files));
      }}
    >
      <input
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        ref={input}
        hidden
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.currentTarget.value = "";
        }}
      />
      <div className="w-full min-w-0">
        {children ?? (
          <>
            <UploadCloudIcon
              aria-hidden="true"
              className="mx-auto mb-3 size-7 text-muted-foreground"
            />
            <p className="text-sm font-medium">
              {mobile ? "Selecione no seu dispositivo" : "Arraste os arquivos para cá"}
            </p>
            {!mobile && (
              <p className="mt-1 text-xs text-muted-foreground">ou escolha no seu dispositivo</p>
            )}
          </>
        )}
        <Button
          type="button"
          className="mt-4"
          disabled={disabled}
          onClick={() => input.current?.click()}
          variant="outline"
        >
          {replacing ? <ReplaceIcon aria-hidden="true" /> : <PlusIcon aria-hidden="true" />}
          {buttonLabel ?? (mobile ? "Selecionar arquivos" : "Escolher arquivos")}
        </Button>
      </div>
    </div>
  );
}
