import { appearancePreferenceSchema, type AppearancePreference } from "@lazuli/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useLayoutEffect, type ReactNode } from "react";
import { useTheme } from "next-themes";
import { apiRequest } from "@/lib/api-client.ts";
import { QUERY_KEY_ROOTS } from "@/lib/query-key-roots.ts";

type Theme = AppearancePreference["theme"];
const readCachedTheme = (key: string): Theme => {
  try {
    return appearancePreferenceSchema.parse({ theme: localStorage.getItem(key) }).theme;
  } catch {
    return "system";
  }
};
const cacheTheme = (key: string, theme: Theme) => {
  try {
    localStorage.setItem(key, theme);
  } catch {
    /* The server still persists the choice. */
  }
};
const AppearanceContext = createContext<{
  theme: Theme;
  pending: boolean;
  error: boolean;
  loading: boolean;
  select: (theme: Theme) => void;
  retry: () => void;
} | null>(null);

export const AccountAppearanceProvider = ({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) => {
  const { setTheme, theme: activeTheme } = useTheme();
  const client = useQueryClient();
  const storageKey = `lazuli-appearance:${userId}`;
  const queryKey = [...QUERY_KEY_ROOTS.accountSettings, "appearance", userId];
  const preference = useQuery({
    queryKey,
    enabled: Boolean(userId),
    queryFn: ({ signal }) =>
      apiRequest("/api/account-settings/appearance", appearancePreferenceSchema, { signal }),
  });
  useLayoutEffect(() => {
    if (userId) setTheme(readCachedTheme(storageKey));
  }, [userId, storageKey, setTheme]);
  useEffect(() => {
    if (!preference.data) return;
    cacheTheme(storageKey, preference.data.theme);
    setTheme(preference.data.theme);
  }, [preference.data, storageKey, setTheme]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey && userId) {
        const theme = readCachedTheme(storageKey);
        client.setQueryData(queryKey, { theme });
        setTheme(theme);
        void client.invalidateQueries({ queryKey });
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [client, storageKey, userId, setTheme]);
  const mutation = useMutation({
    mutationFn: (theme: Theme) =>
      apiRequest("/api/account-settings/appearance", appearancePreferenceSchema, {
        method: "PUT",
        body: JSON.stringify({ theme }),
      }),
    onMutate: async (theme) => {
      await client.cancelQueries({ queryKey });
      const previous = preference.data?.theme ?? readCachedTheme(storageKey);
      cacheTheme(storageKey, theme);
      setTheme(theme);
      return previous;
    },
    onSuccess: (value) => {
      client.setQueryData(queryKey, value);
    },
    onError: (_error, _theme, previous) => {
      const theme = previous ?? "system";
      cacheTheme(storageKey, theme);
      setTheme(theme);
    },
  });
  return (
    <AppearanceContext
      value={{
        theme: activeTheme === "dark" || activeTheme === "light" ? activeTheme : "system",
        pending: mutation.isPending,
        error: preference.isError || mutation.isError,
        loading: preference.isPending,
        select: (theme) => mutation.mutate(theme),
        retry: () => {
          if (mutation.isError && mutation.variables) mutation.mutate(mutation.variables);
          else void preference.refetch();
        },
      }}
    >
      {children}
    </AppearanceContext>
  );
};

export const useAppearance = () => {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("Appearance provider is missing");
  return value;
};
