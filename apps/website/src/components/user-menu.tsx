import { useState } from "react";
import { ChevronsUpDownIcon, LogOutIcon } from "lucide-react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

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
import { authClient } from "@/features/auth/auth-client.ts";

type UserMenuProps = {
  user: {
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

export const UserMenu = ({ user }: UserMenuProps) => {
  const navigate = useNavigate();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    const { error } = await authClient.signOut();

    if (error) {
      setIsSigningOut(false);
      toast.error("Não foi possível sair. Tente novamente.");
      return;
    }

    await navigate("/login", { replace: true });
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="h-12" size="lg">
              <Avatar className="size-8 rounded-none">
                {user.image && <AvatarImage alt="" src={user.image} />}
                <AvatarFallback className="rounded-none">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </span>
              <ChevronsUpDownIcon aria-hidden="true" className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-64 rounded-none border-border/90 p-1 shadow-[4px_4px_0_color-mix(in_oklch,var(--primary),transparent_88%)]"
            side="right"
            sideOffset={8}
          >
            <DropdownMenuLabel className="flex items-center gap-3 rounded-none px-3 py-3 font-normal">
              <Avatar className="size-9 rounded-none border">
                {user.image && <AvatarImage alt="" src={user.image} />}
                <AvatarFallback className="rounded-none">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="truncate font-heading text-base font-medium text-foreground">
                  {user.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="rounded-none px-3 py-2"
              disabled={isSigningOut}
              onSelect={() => void signOut()}
              variant="destructive"
            >
              {isSigningOut ? <Spinner aria-hidden="true" /> : <LogOutIcon aria-hidden="true" />}
              {isSigningOut ? "Saindo…" : "Sair"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
};
