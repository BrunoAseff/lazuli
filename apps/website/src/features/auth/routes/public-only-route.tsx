import { Navigate, Outlet } from "react-router";

import { authClient } from "@/features/auth/auth-client.ts";
import { SessionError, SessionLoading } from "@/features/auth/components/session-feedback.tsx";

export const PublicOnlyRoute = () => {
  const { data, error, isPending } = authClient.useSession();

  if (isPending) {
    return <SessionLoading />;
  }

  if (error) {
    return <SessionError />;
  }

  return data ? <Navigate replace to="/documents" /> : <Outlet />;
};
