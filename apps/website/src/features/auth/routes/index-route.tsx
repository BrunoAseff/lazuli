import { Navigate } from "react-router";

import { authClient } from "@/features/auth/auth-client.ts";
import { SessionError, SessionLoading } from "@/features/auth/components/session-feedback.tsx";

export const IndexRoute = () => {
  const { data, error, isPending } = authClient.useSession();

  if (isPending) {
    return <SessionLoading />;
  }

  if (error) {
    return <SessionError />;
  }

  return <Navigate replace to={data ? "/documents" : "/login"} />;
};
