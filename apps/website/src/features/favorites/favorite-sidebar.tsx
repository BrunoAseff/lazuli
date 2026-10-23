import { favoriteListSchema } from "@lazuli/shared";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "react-router";
import {
  DocumentDomainIcon,
  ProjectClosedIcon,
  FlashcardDomainIcon,
  QuizDomainIcon,
} from "@/components/domain-icons.ts";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar.tsx";
import { apiRequest } from "@/lib/api-client.ts";
import { favoriteKeys } from "./favorite-provider.tsx";
import { useGlobalSearch } from "@/features/search/global-search-provider.tsx";

const favoriteIcons = {
  project: ProjectClosedIcon,
  document: DocumentDomainIcon,
  flashcards: FlashcardDomainIcon,
  quizzes: QuizDomainIcon,
};

export const FavoriteSidebar = ({ onNavigate }: { onNavigate: () => void }) => {
  const query = useQuery({
    queryKey: [...favoriteKeys, "list"],
    queryFn: ({ signal }) => apiRequest("/api/favorites", favoriteListSchema, { signal }),
  });
  const { openSearch } = useGlobalSearch();
  if (!query.data?.items.length && !query.isError) return null;
  return (
    <SidebarGroup className="mt-5 p-0">
      <SidebarGroupLabel className="h-auto px-2 pb-1.5 text-[0.68rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">
        Favoritos
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {query.isError && (
            <SidebarMenuItem>
              <SidebarMenuButton
                className="h-auto min-h-11 whitespace-normal text-xs text-destructive"
                onClick={() => void query.refetch()}
              >
                Não foi possível carregar. Tentar novamente
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          {query.data?.items.slice(0, 4).map((item) => {
            const Icon = favoriteIcons[item.kind];
            return (
              <SidebarMenuItem key={`${item.kind}:${item.id}`}>
                <SidebarMenuButton
                  asChild
                  className="h-8 rounded-md px-2 text-[0.875rem] font-normal [&_svg]:size-[1.05rem]"
                >
                  <NavLink to={item.href} onClick={onNavigate}>
                    <Icon aria-hidden="true" weight="duotone" />
                    <OverflowTooltip
                      side="right"
                      text={item.context ? `${item.title} · ${item.context}` : item.title}
                    >
                      {(ref) => (
                        <span ref={ref} className="min-w-0 flex-1 truncate">
                          {item.title}
                        </span>
                      )}
                    </OverflowTooltip>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
          <SidebarMenuItem>
            <SidebarMenuButton
              className="text-xs text-muted-foreground"
              onClick={() => {
                onNavigate();
                openSearch(true);
              }}
            >
              Ver todos os favoritos
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
};
