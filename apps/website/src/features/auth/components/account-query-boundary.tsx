import { useLayoutEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SessionLoading } from "./session-feedback.tsx";

const activeUserStorageKey = "lazuli-active-user-id";

// Apply identity isolation before legal/essential routes as well as the study shell.
export const AccountQueryBoundary = ({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) => {
  const client = useQueryClient();
  const [cacheUserId, setCacheUserId] = useState<string | null>(() => {
    try {
      return window.sessionStorage.getItem(activeUserStorageKey);
    } catch {
      return null;
    }
  });
  useLayoutEffect(() => {
    if (cacheUserId && cacheUserId !== userId) client.clear();
    try {
      window.sessionStorage.setItem(activeUserStorageKey, userId);
    } catch {
      /* In-memory identity still isolates queries when storage is disabled. */
    }
    setCacheUserId(userId);
  }, [cacheUserId, client, userId]);
  if (cacheUserId !== userId) return <SessionLoading />;
  return children;
};
