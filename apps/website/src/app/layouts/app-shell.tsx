import { Outlet, useMatch } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useState, type CSSProperties } from "react";

import { AppSidebar } from "@/components/app-sidebar.tsx";
import { BrandBadge } from "@/components/brand-mark.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar.tsx";
import { DocumentImportProvider } from "@/features/document-imports/document-import-provider.tsx";
import { authClient } from "@/features/auth/auth-client.ts";
import { SessionLoading } from "@/features/auth/components/session-feedback.tsx";
import { BillingProvider } from "@/features/billing/billing-context.tsx";
import { AnalyticsProvider } from "@/features/analytics/analytics-provider.tsx";
import { AccountAppearanceProvider } from "@/features/account-settings/appearance-provider.tsx";
import { FavoriteProvider } from "@/features/favorites/favorite-provider.tsx";
import { GlobalSearchProvider } from "@/features/search/global-search-provider.tsx";
import { GlobalSearchButton } from "@/features/search/global-search-button.tsx";

const activeUserStorageKey = "lazuli-active-user-id";

export const AppShell = () => {
  const projectWorkspace = useMatch("/documents/:projectId/*");
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
    <AccountAppearanceProvider key={userId} userId={userId ?? ""}>
      <FavoriteProvider>
        <GlobalSearchProvider userId={userId ?? ""}>
          <AnalyticsProvider userId={userId ?? ""}>
            <BillingProvider>
              <SidebarProvider
                style={
                  {
                    "--sidebar-width": "13.375rem",
                    "--sidebar-width-icon": "13.375rem",
                  } as CSSProperties
                }
              >
                <AppSidebar />
                <SidebarInset>
                  <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/85 md:hidden">
                    <SidebarTrigger />
                    <Separator orientation="vertical" />
                    <BrandBadge className="size-8" />
                    <span className="font-heading text-xl font-medium tracking-[-0.02em]">
                      Lazúli
                    </span>
                    <GlobalSearchButton
                      compact
                      className={projectWorkspace ? "mr-12" : undefined}
                    />
                  </header>
                  <DocumentImportProvider key={userId} userId={userId ?? ""}>
                    <Outlet />
                  </DocumentImportProvider>
                </SidebarInset>
              </SidebarProvider>
            </BillingProvider>
          </AnalyticsProvider>
        </GlobalSearchProvider>
      </FavoriteProvider>
    </AccountAppearanceProvider>
  );
};

export default AppShell;
