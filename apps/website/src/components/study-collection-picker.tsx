import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import type { ReactNode } from "react";

import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { SearchInput } from "@/components/search-input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { cn } from "@/lib/utils.ts";

type CollectionOption = { id: string; title: string };

export const StudyCollectionPicker = ({
  disabled = false,
  empty,
  footer,
  items,
  loading,
  onChange,
  onOpenChange,
  onQueryChange,
  open,
  query,
  selectedTitle,
  value,
}: {
  disabled?: boolean;
  empty: string;
  footer?: ReactNode;
  items: ReadonlyArray<CollectionOption>;
  loading: boolean;
  onChange: (value: string) => void;
  onOpenChange: (open: boolean) => void;
  onQueryChange: (value: string) => void;
  open: boolean;
  query: string;
  selectedTitle?: string;
  value: string;
}) => (
  <div>
    <label className="mb-2 block text-sm font-medium">Coleção</label>
    <Popover onOpenChange={onOpenChange} open={open}>
      <PopoverTrigger asChild>
        <Button className="w-full justify-between" disabled={disabled} variant="outline">
          <OverflowTooltip text={selectedTitle ?? "Selecionar coleção"}>
            {(ref) => (
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-left",
                  !selectedTitle && "text-muted-foreground",
                )}
                ref={ref}
              >
                {selectedTitle ?? "Selecionar coleção"}
              </span>
            )}
          </OverflowTooltip>
          <ChevronsUpDownIcon aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <div className="border-b p-2">
          <SearchInput
            onValueChange={onQueryChange}
            placeholder="Pesquisar coleções"
            value={query}
          />
        </div>
        <div className="max-h-64 space-y-0.5 overflow-y-auto p-2 lazuli-thin-scrollbar">
          {items.map((collection) => (
            <button
              className={cn(
                "flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted",
                collection.id === value && "bg-muted",
              )}
              key={collection.id}
              onClick={() => onChange(collection.id)}
              type="button"
            >
              <OverflowTooltip text={collection.title}>
                {(ref) => (
                  <span className="truncate" ref={ref}>
                    {collection.title}
                  </span>
                )}
              </OverflowTooltip>
              {collection.id === value && <CheckIcon aria-hidden="true" className="size-4" />}
            </button>
          ))}
          {!loading && !items.length && (
            <p className="p-3 text-sm text-muted-foreground">{empty}</p>
          )}
          {footer}
        </div>
      </PopoverContent>
    </Popover>
  </div>
);
