import { useRef } from "react";
import { Navigate, Outlet } from "react-router";

import { authClient } from "@/features/auth/auth-client.ts";
import { SessionError, SessionLoading } from "@/features/auth/components/session-feedback.tsx";

type PublicOnlySessionState = {
  data: unknown;
  error: unknown;
  isPending: boolean;
};

export const resolvePublicOnlyRoute = (
  session: PublicOnlySessionState,
  previouslyResolved: boolean,
) => {
  const resolved = previouslyResolved || (!session.isPending && !session.error);
  if (session.data) return { resolved, view: "authenticated" as const };
  if (!resolved)
    return { resolved, view: session.error ? ("error" as const) : ("loading" as const) };
  return { resolved, view: "public" as const };
};

export const PublicOnlyRoute = () => {
  const session = authClient.useSession();
  const sessionResolved = useRef(false);
  const route = resolvePublicOnlyRoute(session, sessionResolved.current);
  sessionResolved.current = route.resolved;

  if (route.view === "loading") return <SessionLoading />;

  if (route.view === "error") return <SessionError />;

  return route.view === "authenticated" ? <Navigate replace to="/documents" /> : <Outlet />;
};
