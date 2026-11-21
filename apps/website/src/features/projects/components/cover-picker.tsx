import type { ProjectCoverKey } from "@lazuli/shared";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import { CheckIcon } from "@/components/icons.tsx";
import { spring } from "@/lib/motion.ts";

import { cn } from "@/lib/utils.ts";
import { PROJECT_COVERS } from "../project-covers.ts";
import { ProjectCover } from "./project-cover.tsx";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx";

type CoverPickerProps = {
  disabled?: boolean;
  onChange: (value: ProjectCoverKey | null) => void;
  /** `null` is "Sem capa"; `undefined` selects nothing (the project uses an uploaded image). */
  value: ProjectCoverKey | null | undefined;
};

export const CoverPicker = ({ disabled, onChange, value }: CoverPickerProps) => {
  const reduced = useReducedMotion();
  const group = useId();
  const options = [
    { key: null, label: "Sem capa", description: "Visual neutro" },
    ...PROJECT_COVERS,
  ] as const;

  return (
    <fieldset disabled={disabled}>
      <legend className="mb-3 text-sm font-medium">Capa</legend>
      <LayoutGroup id={group}>
        <RadioGroup
          aria-label="Capa"
          disabled={disabled}
          value={value === undefined ? "" : (value ?? "none")}
          onValueChange={(next) => onChange(next === "none" ? null : (next as ProjectCoverKey))}
          className="grid grid-cols-2 gap-3 p-1 sm:grid-cols-5"
        >
          {options.map((cover) => {
            const selected = value === cover.key;
            const inputValue = cover.key ?? "none";
            return (
              <RadioGroupItem
                className={cn(
                  "group relative block h-auto w-full cursor-pointer rounded-[var(--radius-panel)] border bg-card text-left text-foreground transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=checked]:bg-card",
                  // Hover strengthens the edge, as on outline buttons; the selection is drawn above.
                  !selected &&
                    "hover:border-[color-mix(in_oklab,var(--foreground)_26%,transparent)]",
                  disabled && "cursor-not-allowed opacity-60",
                )}
                key={inputValue}
                value={inputValue}
              >
                {/* The image is clipped here, not on the option, so the travelling outline is never cut. */}
                <span className="block overflow-hidden rounded-t-[calc(var(--radius-xl)-1px)]">
                  <ProjectCover className="h-auto" coverKey={cover.key} picker />
                </span>
                <span className="flex items-center gap-2 px-2 py-2 text-xs font-medium">
                  <span className="truncate">{cover.label}</span>
                  <AnimatePresence initial={false}>
                    {selected && (
                      <motion.span
                        animate={{ opacity: 1, scale: 1 }}
                        className="ml-auto"
                        exit={{ opacity: 0, scale: 0.6 }}
                        initial={reduced ? false : { opacity: 0, scale: 0.6 }}
                        transition={spring.snap}
                      >
                        <CheckIcon aria-hidden="true" className="size-3.5 text-primary" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                {/* One outline that travels to the chosen cover instead of jumping between them. */}
                {selected && (
                  <motion.span
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-px rounded-[var(--radius-panel)] border-2 border-primary"
                    layoutId="cover-picker-selection"
                    transition={reduced ? { duration: 0 } : spring.morph}
                  />
                )}
              </RadioGroupItem>
            );
          })}
        </RadioGroup>
      </LayoutGroup>
    </fieldset>
  );
};
