import { DatabaseIcon } from "@/components/icons.tsx";
import { GraduationCapIcon } from "@/components/icons.tsx";
import { ShieldCheckIcon } from "@/components/icons.tsx";
import { UserCircleIcon } from "@/components/icons.tsx";
import { PaletteIcon } from "@/components/icons.tsx";
import { HardDriveIcon } from "@/components/icons.tsx";
import { useQueryClient } from "@tanstack/react-query";
import { Suspense, useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router";

import { ContentPage } from "@/components/content-page.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { cn } from "@/lib/utils.ts";
import { prefetchAccountSettings } from "../api/account-settings-queries.ts";
import { SettingsLoading } from "../components/settings-ui.tsx";

/** The sections' code, loaded together when Settings opens (the same modules the routes use). */
const preloadSections = () =>
  Promise.allSettled([
    import("./account-section-page.tsx"),
    import("./security-section-page.tsx"),
    import("./study-section-page.tsx"),
    import("./appearance-section-page.tsx"),
    import("./usage-section-page.tsx"),
    import("./data-section-page.tsx"),
  ]);

const sections = [
  { Icon: UserCircleIcon, label: "Conta", path: "/settings/account" },
  { Icon: ShieldCheckIcon, label: "Acesso e segurança", path: "/settings/security" },
  { Icon: PaletteIcon, label: "Aparência", path: "/settings/appearance" },
  { Icon: HardDriveIcon, label: "Uso e materiais", path: "/settings/usage" },
  { Icon: GraduationCapIcon, label: "Estudo", path: "/settings/study" },
  { Icon: DatabaseIcon, label: "Dados e privacidade", path: "/settings/data" },
] as const;

export const AccountSettingsLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const current = sections.find(({ path }) => location.pathname === path) ?? sections[0];
  const client = useQueryClient();
  useEffect(() => {
    void preloadSections();
    void prefetchAccountSettings(client);
  }, [client]);

  return (
    <ContentPage maxWidth="5xl">
      <div className="lg:hidden">
        <Select value={current.path} onValueChange={(value) => void navigate(value)}>
          <SelectTrigger className="w-full" aria-label="Seção das configurações">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sections.map(({ Icon, label, path }) => (
              <SelectItem key={path} value={path}>
                <Icon aria-hidden="true" />
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 grid items-start gap-8 lg:mt-0 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-12">
        <nav aria-label="Configurações" className="sticky top-8 hidden lg:block">
          <ul className="grid gap-1">
            {sections.map(({ Icon, label, path }) => (
              <li key={path}>
                <NavLink
                  className={({ isActive }) =>
                    cn(
                      "flex min-h-10 items-center gap-2.5 rounded-[var(--radius)] px-3 py-2 text-sm text-muted-foreground transition-colors outline-none hover:bg-muted/55 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/35",
                      isActive && "bg-muted text-foreground",
                    )
                  }
                  to={path}
                >
                  <Icon aria-hidden="true" className="size-[1.1rem]" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 max-w-2xl">
          <Suspense fallback={<SettingsLoading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </ContentPage>
  );
};

export default AccountSettingsLayout;
