import { Navigate, Outlet, useLocation } from "react-router";

import { authClient } from "@/features/auth/auth-client.ts";
import { SessionError, SessionLoading } from "@/features/auth/components/session-feedback.tsx";

export const PrivateRoute = () => {
  const location = useLocation();
  const { data, error, isPending } = authClient.useSession();

  if (isPending) {
    return <SessionLoading />;
  }

  if (error) {
    return <SessionError />;
  }

  if (!data) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  return <Outlet />;
};
