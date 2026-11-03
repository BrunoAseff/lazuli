import { useLayoutEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SessionLoading } from "./session-feedback.tsx";

const activeUserStorageKey = "lazuli-active-user-id";
let lastUserId: string | null = null;

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
      return window.sessionStorage.getItem(activeUserStorageKey) ?? lastUserId;
    } catch {
      return lastUserId;
    }
  });
  useLayoutEffect(() => {
    if ((cacheUserId && cacheUserId !== userId) || (lastUserId && lastUserId !== userId))
      client.clear();
    lastUserId = userId;
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
