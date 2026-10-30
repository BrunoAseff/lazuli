import { Outlet, useMatch } from "react-router";
import { type CSSProperties } from "react";

import { AppSidebar } from "@/components/app-sidebar.tsx";
import { BrandBadge } from "@/components/brand-mark.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar.tsx";
import { DocumentImportProvider } from "@/features/document-imports/document-import-provider.tsx";
import { authClient } from "@/features/auth/auth-client.ts";
import { BillingProvider } from "@/features/billing/billing-context.tsx";
import { AnalyticsProvider } from "@/features/analytics/analytics-provider.tsx";
import { FavoriteProvider } from "@/features/favorites/favorite-provider.tsx";
import { GlobalSearchProvider } from "@/features/search/global-search-provider.tsx";
import { GlobalSearchButton } from "@/features/search/global-search-button.tsx";

export const AppShell = () => {
  const projectWorkspace = useMatch("/documents/:projectId/*");
  const session = authClient.useSession();
  const userId = session.data?.user.id;

  return (
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
                  <GlobalSearchButton compact className={projectWorkspace ? "mr-12" : undefined} />
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
  );
};

export default AppShell;
