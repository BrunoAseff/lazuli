import type { ProjectCoverKey } from "@lazuli/shared";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils.ts";
import { PROJECT_COVERS } from "../project-covers.ts";
import { ProjectCover } from "./project-cover.tsx";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx";

type CoverPickerProps = {
  disabled?: boolean;
  onChange: (value: ProjectCoverKey | null) => void;
  value: ProjectCoverKey | null;
};

export const CoverPicker = ({ disabled, onChange, value }: CoverPickerProps) => {
  const options = [
    { key: null, label: "Sem capa", description: "Visual neutro" },
    ...PROJECT_COVERS,
  ] as const;

  return (
    <fieldset disabled={disabled}>
      <legend className="mb-3 text-sm font-medium">Capa</legend>
      <RadioGroup
        aria-label="Capa"
        disabled={disabled}
        value={value ?? "none"}
        onValueChange={(next) => onChange(next === "none" ? null : (next as ProjectCoverKey))}
        className="grid grid-cols-2 gap-3 p-1 sm:grid-cols-5"
      >
        {options.map((cover) => {
          const selected = value === cover.key;
          const inputValue = cover.key ?? "none";
          return (
            <RadioGroupItem
              className={cn(
                "group relative h-auto w-full cursor-pointer overflow-hidden rounded-xl border bg-card text-left text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring/40",
                selected ? "border-primary ring-1 ring-primary" : "hover:bg-muted",
                disabled && "cursor-not-allowed opacity-60",
              )}
              key={inputValue}
              value={inputValue}
            >
              <ProjectCover className="h-auto" coverKey={cover.key} picker />
              <span className="flex items-center gap-2 px-2 py-2 text-xs font-medium">
                <span className="truncate">{cover.label}</span>
                {selected && (
                  <CheckIcon aria-hidden="true" className="ml-auto size-3.5 text-primary" />
                )}
              </span>
            </RadioGroupItem>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
};
