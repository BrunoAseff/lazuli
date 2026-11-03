import { FilterIcon } from "lucide-react";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { mergeSearchParams } from "@/lib/search-params.ts";
import { FilterCount } from "@/components/filter-count.tsx";

export const FavoriteFilter = () => {
  const [params, setParams] = useSearchParams();
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
      <Checkbox
        checked={params.get("favorites") === "only"}
        onCheckedChange={(checked) =>
          setParams((current) =>
            mergeSearchParams(current, {
              favorites: checked === true ? "only" : undefined,
              sort: undefined,
            }),
          )
        }
      />
      Somente favoritos
    </label>
  );
};

export const FavoriteFilterMenu = () => {
  const [params] = useSearchParams();
  const activeFilters = Number(params.get("favorites") === "only");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label={
            activeFilters ? `Filtrar projetos (${activeFilters} ativo)` : "Filtrar projetos"
          }
          variant="outline"
        >
          <FilterIcon aria-hidden="true" />
          <span className="hidden sm:inline">Filtros</span>
          <FilterCount count={activeFilters} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-4">
        <FavoriteFilter />
      </PopoverContent>
    </Popover>
  );
};
