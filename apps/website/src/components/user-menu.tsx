import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  const queryClient = useQueryClient();
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

    queryClient.clear();
    localStorage.removeItem(`lazuli-document-imports-completed-dismissed-at:${user.id}`);
    await navigate("/login", { replace: true });
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
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
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
            <DropdownMenuItem
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
