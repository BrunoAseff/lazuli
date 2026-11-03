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

const favoriteLabels = {
  project: "Projeto",
  document: "Documento",
  flashcards: "Flashcards",
  quizzes: "Quiz",
};

export const FavoriteSidebar = ({ onNavigate }: { onNavigate: () => void }) => {
  const query = useQuery({
    queryKey: [...favoriteKeys, "list"],
    queryFn: ({ signal }) => apiRequest("/api/favorites", favoriteListSchema, { signal }),
  });
  const { openSearch } = useGlobalSearch();
  if (!query.data?.items.length && !query.isError) return null;
  return (
    <SidebarGroup className="mt-4 p-0">
      <SidebarGroupLabel className="h-auto px-2 pb-1.5 text-xs font-normal text-muted-foreground">
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
                <SidebarMenuButton asChild className="app-nav-item">
                  <NavLink
                    aria-label={`${favoriteLabels[item.kind]}: ${item.title}`}
                    to={item.href}
                    onClick={onNavigate}
                  >
                    <Icon aria-hidden="true" weight="duotone" />
                    <OverflowTooltip
                      side="right"
                      text={`${item.title} · ${favoriteLabels[item.kind]}${item.context ? ` · ${item.context}` : ""}`}
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
              className="app-nav-item text-[0.8125rem] text-muted-foreground"
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
