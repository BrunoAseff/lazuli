import type { ProjectCoverKey } from "@lazuli/shared";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils.ts";
import { PROJECT_COVERS } from "../project-covers.ts";
import { ProjectCover } from "./project-cover.tsx";

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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {options.map((cover) => {
          const selected = value === cover.key;
          const inputValue = cover.key ?? "none";
          return (
            <label
              className={cn(
                "group relative cursor-pointer overflow-hidden border bg-card transition-colors focus-within:ring-3 focus-within:ring-ring/40",
                selected ? "border-primary ring-1 ring-primary" : "hover:border-foreground/35",
                disabled && "cursor-not-allowed opacity-60",
              )}
              key={inputValue}
            >
              <input
                checked={selected}
                className="sr-only"
                name="project-cover"
                onChange={() => onChange(cover.key)}
                type="radio"
                value={inputValue}
              />
              <ProjectCover coverKey={cover.key} picker />
              <span className="flex items-center gap-2 px-2 py-2 text-xs font-medium">
                <span className="truncate">{cover.label}</span>
                {selected && (
                  <CheckIcon aria-hidden="true" className="ml-auto size-3.5 text-primary" />
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};
