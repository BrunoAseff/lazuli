import { FileTextIcon } from "lucide-react";
import { NavLink } from "react-router";

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

  if (!session) {
    return null;
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b p-3">
        <div className="flex h-9 items-center gap-2 px-1">
          <span className="flex size-7 shrink-0 rotate-45 items-center justify-center border border-primary bg-primary text-primary-foreground">
            <span className="block size-2 -rotate-45 border border-current" />
          </span>
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
                <SidebarMenuButton asChild isActive tooltip="Documentos">
                  <NavLink
                    aria-current="page"
                    onClick={() => isMobile && setOpenMobile(false)}
                    to="/documents"
                  >
                    <FileTextIcon aria-hidden="true" />
                    <span>Documentos</span>
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
