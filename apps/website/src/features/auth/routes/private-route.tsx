import { Navigate, Outlet, useLocation } from "react-router";
import { lazy } from "react";

import { authClient } from "@/features/auth/auth-client.ts";
import { SessionError, SessionLoading } from "@/features/auth/components/session-feedback.tsx";
import { AccountQueryBoundary } from "../components/account-query-boundary.tsx";

const LegalGate = lazy(() =>
  import("@/features/legal/legal-gate.tsx").then((module) => ({ default: module.LegalGate })),
);

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
    return (
      <Navigate
        replace
        state={{ from: `${location.pathname}${location.search}${location.hash}` }}
        to="/login"
      />
    );
  }

  return (
    <AccountQueryBoundary userId={data.user.id}>
      <LegalGate key={data.user.id} userId={data.user.id}>
        <Outlet />
      </LegalGate>
    </AccountQueryBoundary>
  );
};
