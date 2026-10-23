import { SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { useGlobalSearch } from "./global-search-provider.tsx";
import { cn } from "@/lib/utils.ts";

export const GlobalSearchButton = ({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) => {
  const { openSearch } = useGlobalSearch();
  return (
    <Button
      aria-label="Pesquisar no Lazúli"
      variant="ghost"
      size={compact ? "icon" : "default"}
      className={cn(
        compact
          ? "ml-auto shrink-0"
          : "mb-3 w-full justify-start px-2 font-normal text-muted-foreground",
        className,
      )}
      onClick={() => openSearch()}
    >
      <SearchIcon aria-hidden="true" />
      {!compact && (
        <>
          <span className="flex-1 text-left">Pesquisar</span>
          <kbd className="text-[0.65rem]">Ctrl K</kbd>
        </>
      )}
    </Button>
  );
};
