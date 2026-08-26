import { PROJECT_MAX_PAGE_SIZE } from "@lazuli/shared";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  FolderIcon,
  FolderXIcon,
  Layers3Icon,
  SearchIcon,
  type LucideIcon,
} from "lucide-react";
import { type Ref, useEffect, useState } from "react";

import { HighlightText } from "@/components/highlight-text.tsx";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { useProject, useProjects } from "@/features/projects/api/project-queries.ts";
import { cn } from "@/lib/utils.ts";

export type ProjectFilterValue = string | undefined;

export const ProjectFilter = ({
  allowAll = true,
  disabled,
  fullWidth = false,
  label = "Filtrar por projeto",
  onChange,
  value,
}: {
  allowAll?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  label?: string;
  onChange: (value: ProjectFilterValue) => void;
  value: ProjectFilterValue;
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const hasProject = Boolean(value && value !== "none");
  const selectedProject = useProject(hasProject ? value! : "", hasProject);
  const projects = useProjects({ page: 1, pageSize: PROJECT_MAX_PAGE_SIZE, query }, open);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);
  const selectedLabel =
    value === "none"
      ? "Sem projeto"
      : value
        ? (selectedProject.data?.title ?? "Projeto selecionado")
        : allowAll
          ? "Todos os projetos"
          : "Sem projeto";
  const SelectedIcon = value === "none" ? FolderXIcon : value ? FolderIcon : Layers3Icon;

  const select = (next: ProjectFilterValue) => {
    onChange(next);
    setOpen(false);
    setSearch("");
    setQuery("");
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-label={label}
          className={cn(
            "h-9 min-w-0 justify-between rounded-none",
            fullWidth ? "w-full" : "w-full sm:w-56",
          )}
          disabled={disabled}
          variant="outline"
        >
          <SelectedIcon aria-hidden="true" className="shrink-0 text-muted-foreground" />
          <OverflowTooltip text={selectedLabel}>
            {(ref) => (
              <span className="min-w-0 flex-1 truncate text-left" ref={ref as Ref<HTMLSpanElement>}>
                {selectedLabel}
              </span>
            )}
          </OverflowTooltip>
          <ChevronsUpDownIcon aria-hidden="true" className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-72 p-1.5">
        <div className="relative mb-1.5">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Pesquisar projetos"
            className="h-9 pl-8"
            maxLength={100}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Pesquisar projetos"
            value={search}
          />
        </div>
        <div className="lazuli-thin-scrollbar max-h-64 overflow-y-auto">
          {!query && (
            <div className="mb-1 border-b pb-1">
              {allowAll && (
                <ProjectOption
                  active={value === undefined}
                  icon={Layers3Icon}
                  label="Todos os projetos"
                  onSelect={() => select(undefined)}
                />
              )}
              <ProjectOption
                active={value === "none"}
                icon={FolderXIcon}
                label="Sem projeto"
                onSelect={() => select("none")}
              />
            </div>
          )}
          {projects.isPending && (
            <p className="px-2 py-3 text-xs text-muted-foreground">Carregando projetos...</p>
          )}
          {projects.isError && (
            <p className="px-2 py-3 text-xs text-destructive">
              Não foi possível carregar os projetos.
            </p>
          )}
          {!query && Boolean(projects.data?.items.length) && (
            <p className="px-2 pt-1.5 pb-1 text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">
              Projetos
            </p>
          )}
          {projects.data?.items.map((project) => (
            <ProjectOption
              active={value === project.id}
              icon={FolderIcon}
              key={project.id}
              label={project.title}
              onSelect={() => select(project.id)}
              query={query}
            />
          ))}
          {projects.data?.pagination.totalItems === 0 && query && (
            <p className="px-2 py-3 text-xs text-muted-foreground">Nenhum projeto encontrado.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

const ProjectOption = ({
  active,
  icon: Icon,
  label,
  onSelect,
  query = "",
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
  query?: string;
}) => (
  <button
    className={cn(
      "flex w-full items-center gap-2 px-2 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active && "bg-muted",
    )}
    onClick={onSelect}
    type="button"
  >
    <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
    <OverflowTooltip text={label}>
      {(ref) => (
        <span className="min-w-0 flex-1 truncate" ref={ref as Ref<HTMLSpanElement>}>
          <HighlightText query={query} text={label} />
        </span>
      )}
    </OverflowTooltip>
    {active && <CheckIcon aria-hidden="true" className="size-3.5 shrink-0" />}
  </button>
);
