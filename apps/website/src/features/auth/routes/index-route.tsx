import { lazy } from "react";
import { Navigate } from "react-router";

import { authClient } from "@/features/auth/auth-client.ts";
const LandingPage = lazy(() => import("@/features/landing/landing-page.tsx"));

export const IndexRoute = () => {
  const { data } = authClient.useSession();

  // The public page remains useful while session resolution is pending or offline.
  return data ? <Navigate replace to="/dashboard" /> : <LandingPage />;
};
