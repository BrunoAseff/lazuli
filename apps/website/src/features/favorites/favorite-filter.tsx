import { FilterIcon } from "lucide-react";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { mergeSearchParams } from "@/lib/search-params.ts";

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
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button aria-label="Filtrar projetos" variant="outline">
          <FilterIcon aria-hidden="true" />
          <span className="hidden sm:inline">Filtros</span>
          {params.get("favorites") === "only" && (
            <span className="size-1.5 rounded-full bg-primary" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-4">
        <FavoriteFilter />
      </PopoverContent>
    </Popover>
  );
};
