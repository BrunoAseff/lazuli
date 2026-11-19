import { SearchIcon } from "@/components/icons.tsx";
import { Kbd } from "@/components/ui/kbd.tsx";
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
          : "mb-2 h-10 w-full justify-start border-border/55 bg-card/65 px-2 text-foreground md:h-8 font-normal hover:bg-card",
        className,
      )}
      onClick={() => openSearch()}
    >
      <SearchIcon aria-hidden="true" />
      {!compact && (
        <>
          <span className="flex-1 text-left">Pesquisar</span>
          <Kbd className="text-muted-foreground opacity-100">Ctrl K</Kbd>
        </>
      )}
    </Button>
  );
};
