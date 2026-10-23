import { useState } from "react";
import { ChevronsUpDownIcon, LogOutIcon, SettingsIcon } from "lucide-react";
import { useLocation, useNavigate } from "react-router";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { startSignOut } from "@/features/auth/sign-out.ts";
import { useBillingSummary } from "@/features/billing/api/billing-queries.ts";
import { ManageSubscriptionAction } from "@/features/billing/components/manage-subscription-action.tsx";

type UserMenuProps = {
  mobile?: boolean;
  user: {
    id: string;
    email: string;
    image?: string | null;
    name: string;
  };
};

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

export const UserMenu = ({ mobile = false, user }: UserMenuProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const summary = useBillingSummary();
  const planName =
    summary.data?.plan === "specialist"
      ? "Especialista"
      : summary.data?.plan === "essential"
        ? "Essencial"
        : "Básico";

  const signOut = () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    startSignOut({ returnTo, userId: user.id });
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              className="h-11 rounded-md px-2 shadow-none hover:shadow-none data-[state=open]:shadow-none"
              size="lg"
            >
              <Avatar className="size-8">
                {user.image && <AvatarImage alt="" src={user.image} />}
                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate font-normal">{user.name}</span>
                <span className="truncate text-xs text-primary">Plano {planName}</span>
              </span>
              <ChevronsUpDownIcon aria-hidden="true" className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align={mobile ? "start" : "end"}
            className="w-64 max-w-[calc(100vw-1rem)]"
            side={mobile ? "top" : "right"}
            sideOffset={8}
          >
            <DropdownMenuLabel className="flex items-center gap-3 px-3 py-3 font-normal">
              <Avatar className="size-9 border">
                {user.image && <AvatarImage alt="" src={user.image} />}
                <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="truncate text-sm font-medium text-foreground">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <ManageSubscriptionAction />
            <DropdownMenuItem onSelect={() => void navigate("/settings/account")}>
              <SettingsIcon aria-hidden="true" />
              Configurações
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={isSigningOut} onSelect={signOut} variant="destructive">
              {isSigningOut ? <Spinner aria-hidden="true" /> : <LogOutIcon aria-hidden="true" />}
              {isSigningOut ? "Saindo…" : "Sair"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
