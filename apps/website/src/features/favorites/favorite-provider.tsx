import { favoriteStatesSchema, type FavoriteTarget } from "@lazuli/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api-client.ts";

const keyOf = (target: FavoriteTarget) => `${target.kind}:${target.id}`;
export const favoriteKeys = ["favorites"] as const;
const FavoriteContext = createContext<{
  register: (target: FavoriteTarget) => () => void;
  has: (target: FavoriteTarget) => boolean;
  ready: boolean;
  error: boolean;
  retry: () => void;
  pending: string | null;
  toggle: (target: FavoriteTarget) => void;
} | null>(null);

export const FavoriteProvider = ({ children }: { children: ReactNode }) => {
  const client = useQueryClient();
  const [registered, setRegistered] = useState<
    Map<string, { target: FavoriteTarget; count: number }>
  >(new Map());
  const register = useCallback((target: FavoriteTarget) => {
    const key = keyOf(target);
    setRegistered((current) => {
      const next = new Map(current);
      next.set(key, { target, count: (current.get(key)?.count ?? 0) + 1 });
      return next;
    });
    return () =>
      setRegistered((current) => {
        const next = new Map(current);
        const count = (next.get(key)?.count ?? 1) - 1;
        if (count) next.set(key, { target, count });
        else next.delete(key);
        return next;
      });
  }, []);
  const targets = [...registered.values()]
    .map(({ target }) => target)
    .sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
  const query = useQuery({
    queryKey: [...favoriteKeys, "states", targets],
    enabled: targets.length > 0,
    queryFn: async ({ signal }) => {
      const items: FavoriteTarget[] = [];
      for (let start = 0; start < targets.length; start += 100) {
        const result = await apiRequest("/api/favorites/states", favoriteStatesSchema, {
          method: "POST",
          signal,
          body: JSON.stringify({ targets: targets.slice(start, start + 100) }),
        });
        items.push(...result.items);
      }
      return { items };
    },
  });
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const has = (target: FavoriteTarget) =>
    optimistic[keyOf(target)] ??
    Boolean(query.data?.items.some((item) => keyOf(item) === keyOf(target)));
  const mutation = useMutation({
    mutationFn: ({ target, enabled }: { target: FavoriteTarget; enabled: boolean }) =>
      apiRequest(`/api/favorites/${target.kind}/${target.id}`, null, {
        method: enabled ? "PUT" : "DELETE",
      }),
    onMutate: ({ target, enabled }) => {
      setOptimistic((current) => ({ ...current, [keyOf(target)]: enabled }));
    },
    onError: (_error, { target, enabled }) => {
      setOptimistic((current) => ({ ...current, [keyOf(target)]: !enabled }));
      toast.error("Não foi possível atualizar o favorito. Tente novamente.");
    },
    onSettled: async (_data, _error, { target }) => {
      await Promise.all([
        client.invalidateQueries({ queryKey: favoriteKeys }),
        client.invalidateQueries({ queryKey: ["projects"] }),
        client.invalidateQueries({ queryKey: ["flashcard-collections"] }),
        client.invalidateQueries({ queryKey: ["quiz-collections"] }),
        client.invalidateQueries({ queryKey: ["global-search"] }),
      ]);
      setOptimistic((current) => {
        const next = { ...current };
        delete next[keyOf(target)];
        return next;
      });
    },
  });
  return (
    <FavoriteContext
      value={{
        register,
        has,
        ready: query.isSuccess,
        error: query.isError,
        retry: () => void query.refetch(),
        pending: mutation.isPending ? keyOf(mutation.variables.target) : null,
        toggle: (target) => mutation.mutate({ target, enabled: !has(target) }),
      }}
    >
      {children}
    </FavoriteContext>
  );
};

export const useFavorite = (target: FavoriteTarget) => {
  const context = useContext(FavoriteContext);
  if (!context) throw new Error("Favorite provider is missing");
  const { kind, id } = target;
  useEffect(() => context.register({ kind, id }), [context.register, kind, id]);
  return {
    enabled: context.has(target),
    loading: (!context.ready && !context.error) || context.pending !== null,
    error: context.error,
    toggle: () => {
      if (context.error) context.retry();
      else context.toggle(target);
    },
  };
};
