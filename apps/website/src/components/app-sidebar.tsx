import { NavLink, useLocation } from "react-router";
import { HouseIcon } from "@phosphor-icons/react/House";
import { ChartBarIcon } from "@phosphor-icons/react/ChartBar";

import { BrandMark } from "@/components/brand-mark.tsx";
import {
  DocumentDomainIcon,
  FlashcardDomainIcon,
  ProjectClosedIcon,
  ProjectOpenIcon,
  QuizDomainIcon,
} from "@/components/domain-icons.ts";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { UserMenu } from "@/components/user-menu.tsx";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar.tsx";
import { authClient } from "@/features/auth/auth-client.ts";
import { AiCreditBalance } from "@/features/ai/components/ai-credit-balance.tsx";
import { BillingStatusNotice } from "@/features/billing/components/billing-status-notice.tsx";
import { useRecentProjects } from "@/features/projects/use-recent-projects.ts";
import { FavoriteSidebar } from "@/features/favorites/favorite-sidebar.tsx";
import { GlobalSearchButton } from "@/features/search/global-search-button.tsx";

const primaryNavigation = [
  { label: "Início", path: "/dashboard", Icon: HouseIcon },
  { label: "Documentos", path: "/documents", Icon: DocumentDomainIcon },
  { label: "Flashcards", path: "/flashcards", Icon: FlashcardDomainIcon },
  { label: "Quizzes", path: "/quizzes", Icon: QuizDomainIcon },
  { label: "Estatísticas", path: "/statistics", Icon: ChartBarIcon },
] as const;

export const AppSidebar = () => {
  const { data: session } = authClient.useSession();
  const { isMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  const recentProjects = useRecentProjects(session?.user.id ?? "anonymous");

  if (!session) return null;

  const closeMobileNavigation = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar className="p-0" variant="inset" collapsible="offcanvas">
      <SidebarHeader className="px-2 pt-3 pb-0">
        <NavLink
          aria-label="Ir para o início"
          className="flex h-8 items-center gap-2 rounded-md px-2 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          onClick={closeMobileNavigation}
          to="/dashboard"
        >
          <BrandMark className="size-6" />
          <span className="font-heading text-lg font-medium tracking-tight">Lazúli</span>
        </NavLink>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-2 pt-3">
        <GlobalSearchButton />
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {primaryNavigation.map(({ Icon, label, path }) => (
                <SidebarMenuItem key={path}>
                  <SidebarMenuButton
                    asChild
                    className="app-nav-item"
                    isActive={
                      path === "/dashboard"
                        ? location.pathname === path
                        : location.pathname.startsWith(path)
                    }
                  >
                    <NavLink onClick={closeMobileNavigation} to={path}>
                      <Icon aria-hidden="true" weight="duotone" />
                      <span>{label}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <FavoriteSidebar onNavigate={closeMobileNavigation} />
        {recentProjects.length > 0 && (
          <SidebarGroup className="mt-4 p-0">
            <SidebarGroupLabel className="h-auto px-2 pb-1.5 text-xs font-normal text-muted-foreground">
              Recentes
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {recentProjects.map((project) => {
                  const projectPath = `/documents/${project.id}`;
                  const active = location.pathname.startsWith(projectPath);
                  const ProjectIcon = active ? ProjectOpenIcon : ProjectClosedIcon;

                  return (
                    <SidebarMenuItem key={project.id}>
                      <SidebarMenuButton asChild className="app-nav-item" isActive={active}>
                        <NavLink onClick={closeMobileNavigation} to={projectPath}>
                          <ProjectIcon aria-hidden="true" weight="duotone" />
                          <OverflowTooltip side="right" text={project.title}>
                            {(ref) => (
                              <span ref={ref} className="min-w-0 flex-1 truncate">
                                {project.title}
                              </span>
                            )}
                          </OverflowTooltip>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="gap-2 p-2">
        <BillingStatusNotice />
        <AiCreditBalance />
        <UserMenu mobile={isMobile} user={session.user} />
      </SidebarFooter>
    </Sidebar>
  );
};
