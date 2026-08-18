import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router";

import { SessionLoading } from "@/features/auth/components/session-feedback.tsx";
import { IndexRoute } from "@/features/auth/routes/index-route.tsx";
import { PrivateRoute } from "@/features/auth/routes/private-route.tsx";
import { PublicOnlyRoute } from "@/features/auth/routes/public-only-route.tsx";

const AppShell = lazy(() => import("@/app/layouts/app-shell.tsx"));
const LoginPage = lazy(() => import("@/features/auth/pages/login-page.tsx"));
const RegisterPage = lazy(() => import("@/features/auth/pages/register-page.tsx"));
const VerifyEmailPage = lazy(() => import("@/features/auth/pages/verify-email-page.tsx"));
const ProjectListPage = lazy(() => import("@/features/projects/pages/project-list-page.tsx"));
const ProjectDetailPage = lazy(() => import("@/features/projects/pages/project-detail-page.tsx"));

export const App = () => (
  <Suspense fallback={<SessionLoading />}>
    <Routes>
      <Route element={<IndexRoute />} index />
      <Route element={<PublicOnlyRoute />}>
        <Route element={<LoginPage />} path="login" />
        <Route element={<RegisterPage />} path="register" />
      </Route>
      <Route element={<VerifyEmailPage />} path="verify-email" />
      <Route element={<PrivateRoute />}>
        <Route element={<AppShell />}>
          <Route element={<ProjectListPage />} path="documents" />
          <Route element={<ProjectDetailPage />} path="documents/:projectId" />
        </Route>
      </Route>
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
  </Suspense>
);
