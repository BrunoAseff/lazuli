import { NavLink, useLocation } from "react-router";

import { BrandBadge } from "@/components/brand-mark.tsx";
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
import { useRecentProjects } from "@/features/projects/use-recent-projects.ts";

const primaryNavigation = [
  { label: "Documentos", path: "/documents", Icon: DocumentDomainIcon },
  { label: "Flashcards", path: "/flashcards", Icon: FlashcardDomainIcon },
  { label: "Quizzes", path: "/quizzes", Icon: QuizDomainIcon },
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
    <Sidebar className="border-0" collapsible="offcanvas">
      <SidebarHeader className="px-3 pt-4 pb-2">
        <NavLink
          aria-label="Ir para projetos"
          className="flex h-9 items-center gap-2 rounded-md px-1 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          onClick={closeMobileNavigation}
          to="/documents"
        >
          <BrandBadge />
          <span className="font-heading text-[1.35rem] font-medium tracking-[-0.02em]">Lazúli</span>
        </NavLink>
      </SidebarHeader>

      <SidebarContent className="px-2 pt-2">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {primaryNavigation.map(({ Icon, label, path }) => (
                <SidebarMenuItem key={path}>
                  <SidebarMenuButton
                    asChild
                    className="h-8 rounded-md px-2 text-[0.9rem] font-normal data-active:font-normal [&_svg]:size-[1.1rem]"
                    isActive={location.pathname.startsWith(path)}
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

        {recentProjects.length > 0 && (
          <SidebarGroup className="mt-5 p-0">
            <SidebarGroupLabel className="h-auto px-2 pb-1.5 text-[0.68rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">
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
                      <SidebarMenuButton
                        asChild
                        className="h-8 rounded-md px-2 text-[0.875rem] font-normal data-active:font-normal [&_svg]:size-[1.05rem]"
                        isActive={active}
                      >
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

      <SidebarFooter className="p-2">
        <UserMenu mobile={isMobile} user={session.user} />
      </SidebarFooter>
    </Sidebar>
  );
};
