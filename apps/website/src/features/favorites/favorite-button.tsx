import { HeartIcon } from "lucide-react";
import type { FavoriteKind } from "@lazuli/shared";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { useFavorite } from "./favorite-provider.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";

export const FavoriteButton = ({
  kind,
  id,
  title,
  className,
}: {
  kind: FavoriteKind;
  id: string;
  title: string;
  className?: string;
}) => {
  const favorite = useFavorite({ kind, id });
  const label = favorite.error
    ? "Tentar carregar favorito"
    : favorite.enabled
      ? "Remover dos favoritos"
      : "Favoritar";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={`${label}: ${title}`}
          aria-pressed={favorite.enabled}
          className={cn("shrink-0 max-sm:size-11", className)}
          variant="ghost"
          size="icon"
          disabled={favorite.loading}
          onClick={favorite.toggle}
        >
          <HeartIcon
            aria-hidden="true"
            className={cn(
              favorite.enabled && "fill-primary text-primary",
              favorite.error && "text-destructive",
            )}
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
};
