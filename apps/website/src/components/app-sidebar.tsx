import { SquareCheckBig, FileTextIcon, Layers3Icon } from "lucide-react";
import { NavLink, useLocation } from "react-router";

import { UserMenu } from "@/components/user-menu.tsx";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar.tsx";
import { authClient } from "@/features/auth/auth-client.ts";

export const AppSidebar = () => {
  const { data: session } = authClient.useSession();
  const { isMobile, setOpenMobile } = useSidebar();
  const location = useLocation();

  if (!session) {
    return null;
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b p-3 group-data-[collapsible=icon]:p-2">
        <div className="flex h-9 items-center gap-2 px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <svg aria-hidden="true" className="size-8 shrink-0 text-primary" viewBox="0 0 32 32">
            <path d="M16 1 31 16 16 31 1 16Z" fill="currentColor" />
            <path
              d="m16 1 7 15-7 15-7-15 7-15ZM1 16h30"
              fill="none"
              opacity=".34"
              stroke="var(--primary-foreground)"
              strokeWidth=".75"
            />
          </svg>
          <span className="font-heading text-2xl font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Lazúli
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname.startsWith("/documents")}
                  tooltip="Documentos"
                >
                  <NavLink onClick={() => isMobile && setOpenMobile(false)} to="/documents">
                    <FileTextIcon aria-hidden="true" />
                    <span>Documentos</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname.startsWith("/flashcards")}
                  tooltip="Flashcards"
                >
                  <NavLink onClick={() => isMobile && setOpenMobile(false)} to="/flashcards">
                    <Layers3Icon aria-hidden="true" />
                    <span>Flashcards</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname.startsWith("/quizzes")}
                  tooltip="Quizzes"
                >
                  <NavLink onClick={() => isMobile && setOpenMobile(false)} to="/quizzes">
                    <SquareCheckBig aria-hidden="true" />
                    <span>Quizzes</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <UserMenu user={session.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
};
