import { PlusIcon, ReplaceIcon, UploadCloudIcon } from "@/components/icons.tsx";
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
  description,
  hint,
  busy = false,
}: {
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  children?: ReactNode;
  buttonLabel?: string;
  replacing?: boolean;
  description?: string;
  hint?: string;
  busy?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const mobile = useIsMobile();
  return (
    <div
      className={cn(
        "file-drop-target group/drop relative grid min-h-40 cursor-pointer place-items-center overflow-hidden rounded-xl border border-dashed bg-card p-5 text-center sm:min-h-48 sm:p-7",
        disabled && "cursor-not-allowed opacity-50",
      )}
      aria-disabled={disabled}
      aria-busy={busy}
      data-dragging={dragging && !disabled}
      // The whole target opens the picker; the button inside stays the keyboard entry point.
      onClick={() => {
        if (!disabled && !busy) input.current?.click();
      }}
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
      <span aria-hidden="true" className="file-drop-wash" />
      <div className="relative w-full min-w-0">
        {children ?? (
          <>
            <UploadCloudIcon
              aria-hidden="true"
              className="file-drop-icon mx-auto mb-4 size-8 text-muted-foreground"
            />
            <p className="text-sm font-medium">
              {busy
                ? "Lendo arquivo…"
                : dragging
                  ? "Solte para adicionar"
                  : mobile
                    ? "Selecione no seu dispositivo"
                    : multiple
                      ? "Arraste os arquivos para cá"
                      : "Arraste o arquivo para cá"}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              {description ?? "Escolha os materiais que vão fazer parte do seu estudo."}
            </p>
          </>
        )}
        <Button
          type="button"
          className="mt-4"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            input.current?.click();
          }}
          variant="outline"
        >
          {replacing ? <ReplaceIcon aria-hidden="true" /> : <PlusIcon aria-hidden="true" />}
          {buttonLabel ??
            (multiple
              ? mobile
                ? "Selecionar arquivos"
                : "Escolher arquivos"
              : mobile
                ? "Selecionar arquivo"
                : "Escolher arquivo")}
        </Button>
        {hint && <p className="mt-3 text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  );
}
