import { authClient } from "./auth-client.ts";

const pendingSignOutKey = "lazuli-pending-sign-out";

export type PendingSignOut = {
  returnTo: string;
  userId?: string;
};

type StorageWriter = Pick<Storage, "setItem">;
type StorageReader = Pick<Storage, "getItem" | "removeItem">;

export const startSignOut = (
  pending: PendingSignOut,
  dependencies: {
    replace: (path: string) => void;
    storage: StorageWriter;
  } = {
    replace: (path) => window.location.replace(path),
    storage: sessionStorage,
  },
) => {
  dependencies.storage.setItem(pendingSignOutKey, JSON.stringify(pending));
  dependencies.replace("/signing-out");
};

export const readPendingSignOut = (
  storage: Pick<Storage, "getItem"> = sessionStorage,
): PendingSignOut | null => {
  const value = storage.getItem(pendingSignOutKey);
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<PendingSignOut>;
    if (
      typeof parsed.returnTo !== "string" ||
      !parsed.returnTo.startsWith("/") ||
      parsed.returnTo.startsWith("//")
    )
      return null;
    if (parsed.userId !== undefined && typeof parsed.userId !== "string") return null;
    return { returnTo: parsed.returnTo, ...(parsed.userId ? { userId: parsed.userId } : {}) };
  } catch {
    return null;
  }
};

export const finishSignOut = async (
  pending: PendingSignOut,
  dependencies: {
    removeCompletedImportsState: (userId: string) => void;
    revokeSession: () => Promise<{ error: unknown }>;
    storage: StorageReader;
  } = {
    removeCompletedImportsState: (userId) =>
      localStorage.removeItem(`lazuli-document-imports-completed-dismissed-at:${userId}`),
    revokeSession: () => authClient.signOut(),
    storage: sessionStorage,
  },
) => {
  try {
    const { error } = await dependencies.revokeSession();
    if (error) return { error };

    if (pending.userId) dependencies.removeCompletedImportsState(pending.userId);
    dependencies.storage.removeItem(pendingSignOutKey);
    return { error: null };
  } catch (error) {
    return { error };
  }
};
