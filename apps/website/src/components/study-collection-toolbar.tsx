import type { StudyCollectionStatus } from "@lazuli/shared";
import { ArchiveIcon, FilterIcon, Layers3Icon } from "lucide-react";
import type { ReactNode } from "react";

import { ProjectFilter, type ProjectFilterValue } from "@/components/project-filter.tsx";
import { SearchInput } from "@/components/search-input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { cn } from "@/lib/utils.ts";

export const StudyCollectionToolbar = ({
  onClearSearch,
  onProjectChange,
  onSearchChange,
  onStatusChange,
  project,
  searchValue,
  searchDisabled = false,
  status,
  action,
}: {
  action?: ReactNode;
  onClearSearch: () => void;
  onProjectChange: (value: ProjectFilterValue) => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: StudyCollectionStatus) => void;
  project: ProjectFilterValue;
  searchValue: string;
  searchDisabled?: boolean;
  status: StudyCollectionStatus;
}) => (
  <div className="my-7 flex items-center gap-2">
    <SearchInput
      aria-label="Pesquisar coleções"
      className="h-9"
      containerClassName="flex-1"
      disabled={searchDisabled}
      maxLength={100}
      onClear={onClearSearch}
      onValueChange={onSearchChange}
      placeholder="Pesquisar coleções"
      value={searchValue}
    />
    <Popover>
      <PopoverTrigger asChild>
        <Button aria-label="Filtrar coleções" className="shrink-0" variant="outline">
          <FilterIcon aria-hidden="true" />
          <span className="hidden sm:inline">Filtros</span>
          {(project || status === "archived") && (
            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              {Number(Boolean(project)) + Number(status === "archived")}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] gap-4 p-4">
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Projeto
          </p>
          <ProjectFilter fullWidth onChange={onProjectChange} value={project} />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Estado
          </p>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(
              [
                ["active", "Ativas", Layers3Icon],
                ["archived", "Arquivadas", ArchiveIcon],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                className={cn(
                  "flex h-8 items-center justify-center gap-2 rounded-md px-2 text-sm transition-colors",
                  status === value
                    ? "bg-card text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
                key={value}
                onClick={() => onStatusChange(value)}
                type="button"
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
    {action}
  </div>
);
