import { Outlet } from "react-router";

import { AppSidebar } from "@/components/app-sidebar.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar.tsx";

export const AppShell = () => (
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset>
      <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4 md:hidden">
        <SidebarTrigger />
        <Separator orientation="vertical" />
        <span className="font-heading text-xl font-semibold">Lazúli</span>
      </header>
      <Outlet />
    </SidebarInset>
  </SidebarProvider>
);

export default AppShell;
