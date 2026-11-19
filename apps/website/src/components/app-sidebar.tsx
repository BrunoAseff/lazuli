import { NavLink, useLocation } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { primaryNavigation } from "@/components/primary-navigation.ts";

import { LazuliWordmark } from "@/components/brand-mark.tsx";
import { ProjectClosedIcon, ProjectOpenIcon } from "@/components/domain-icons.ts";
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
import { spring } from "@/lib/motion.ts";
import { AiCreditBalance } from "@/features/ai/components/ai-credit-balance.tsx";
import { BillingStatusNotice } from "@/features/billing/components/billing-status-notice.tsx";
import { useRecentProjects } from "@/features/projects/use-recent-projects.ts";
import { FavoriteSidebar } from "@/features/favorites/favorite-sidebar.tsx";
import { GlobalSearchButton } from "@/features/search/global-search-button.tsx";

export const AppSidebar = () => {
  const { data: session } = authClient.useSession();
  const { isMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  const recentProjects = useRecentProjects(session?.user.id ?? "anonymous");
  const reduced = useReducedMotion();

  if (!session) return null;

  const closeMobileNavigation = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar className="p-0" variant="inset" collapsible="offcanvas">
      <SidebarHeader className="px-3 pt-3 pb-0">
        <NavLink
          aria-label="Ir para o início"
          className="flex h-8 items-center gap-2 rounded-md px-2 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          onClick={closeMobileNavigation}
          to="/dashboard"
        >
          <LazuliWordmark />
        </NavLink>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-3 pt-3">
        <GlobalSearchButton />
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {primaryNavigation.map(({ Icon, label, path }) => {
                const active =
                  path === "/dashboard"
                    ? location.pathname === path
                    : location.pathname.startsWith(path);
                return (
                  <SidebarMenuItem key={path}>
                    {/* One highlight travels between destinations, carrying the facet with it. */}
                    {active && (
                      <motion.span
                        aria-hidden="true"
                        className="app-nav-highlight"
                        layoutId="app-nav-highlight"
                        transition={reduced ? { duration: 0 } : spring.morph}
                      />
                    )}
                    <SidebarMenuButton
                      asChild
                      className="app-nav-item app-nav-primary"
                      isActive={active}
                    >
                      <NavLink onClick={closeMobileNavigation} to={path}>
                        <Icon aria-hidden="true" />
                        <span>{label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
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
                          <ProjectIcon aria-hidden="true" />
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

      <SidebarFooter className="gap-2 px-3 py-2">
        <BillingStatusNotice />
        <AiCreditBalance />
        <UserMenu mobile={isMobile} user={session.user} />
      </SidebarFooter>
    </Sidebar>
  );
};
