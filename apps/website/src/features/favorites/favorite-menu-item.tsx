import type { FavoriteTarget } from "@lazuli/shared";
import { HeartIcon } from "lucide-react";
import { ContextMenuItem } from "@/components/ui/context-menu.tsx";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu.tsx";
import { useFavorite } from "./favorite-provider.tsx";

export const FavoriteMenuItem = ({
  target,
  context = false,
}: {
  target: FavoriteTarget;
  context?: boolean;
}) => {
  const favorite = useFavorite(target);
  const Item = context ? ContextMenuItem : DropdownMenuItem;
  return (
    <Item disabled={favorite.loading} onSelect={favorite.toggle}>
      <HeartIcon
        aria-hidden="true"
        className={favorite.enabled ? "fill-primary text-primary" : undefined}
      />
      {favorite.error
        ? "Tentar carregar favorito"
        : favorite.enabled
          ? "Remover dos favoritos"
          : "Favoritar"}
    </Item>
  );
};
