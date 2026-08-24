import { Outlet } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useState } from "react";

import { AppSidebar } from "@/components/app-sidebar.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar.tsx";
import { DocumentImportProvider } from "@/features/document-imports/document-import-provider.tsx";
import { authClient } from "@/features/auth/auth-client.ts";
import { SessionLoading } from "@/features/auth/components/session-feedback.tsx";

const activeUserStorageKey = "lazuli-active-user-id";

export const AppShell = () => {
  const session = authClient.useSession();
  const queryClient = useQueryClient();
  const userId = session.data?.user.id;
  const [cacheUserId, setCacheUserId] = useState(() =>
    sessionStorage.getItem(activeUserStorageKey),
  );
  useLayoutEffect(() => {
    if (!userId) return;
    if (cacheUserId && cacheUserId !== userId) queryClient.clear();
    sessionStorage.setItem(activeUserStorageKey, userId);
    setCacheUserId(userId);
  }, [cacheUserId, queryClient, userId]);

  if (userId && cacheUserId !== userId) return <SessionLoading />;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4 md:hidden">
          <SidebarTrigger />
          <Separator orientation="vertical" />
          <span className="font-heading text-xl font-semibold">Lazúli</span>
        </header>
        <DocumentImportProvider key={userId} userId={userId ?? ""}>
          <Outlet />
        </DocumentImportProvider>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AppShell;
