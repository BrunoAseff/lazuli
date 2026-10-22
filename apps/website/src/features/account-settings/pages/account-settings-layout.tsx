import { DatabaseIcon } from "@phosphor-icons/react/Database";
import { GraduationCapIcon } from "@phosphor-icons/react/GraduationCap";
import { ShieldCheckIcon } from "@phosphor-icons/react/ShieldCheck";
import { UserCircleIcon } from "@phosphor-icons/react/UserCircle";
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

const sections = [
  { Icon: UserCircleIcon, label: "Conta", path: "/settings/account" },
  { Icon: ShieldCheckIcon, label: "Acesso e segurança", path: "/settings/security" },
  { Icon: GraduationCapIcon, label: "Estudo", path: "/settings/study" },
  { Icon: DatabaseIcon, label: "Dados e privacidade", path: "/settings/data" },
] as const;

export const AccountSettingsLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const current = sections.find(({ path }) => location.pathname === path) ?? sections[0];

  return (
    <ContentPage maxWidth="5xl">
      <div className="md:hidden">
        <Select value={current.path} onValueChange={(value) => void navigate(value)}>
          <SelectTrigger className="w-full" aria-label="Seção das configurações">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sections.map(({ Icon, label, path }) => (
              <SelectItem key={path} value={path}>
                <Icon aria-hidden="true" weight="duotone" />
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-6 grid items-start gap-8 md:mt-0 md:grid-cols-[12rem_minmax(0,1fr)] lg:gap-12">
        <nav aria-label="Configurações" className="sticky top-8 hidden md:block">
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
                  <Icon aria-hidden="true" className="size-[1.1rem]" weight="duotone" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 max-w-2xl">
          <Outlet />
        </main>
      </div>
    </ContentPage>
  );
};

export default AccountSettingsLayout;
