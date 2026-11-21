import type { QueryClient } from "@tanstack/react-query";

import { QUERY_KEY_ROOTS } from "./query-key-roots.ts";

/**
 * The sidebar's favorites and recent projects, and search, show titles too: after a rename (or a
 * collection archived, restored or deleted) they are read again, so no reload is needed.
 */
export const refreshNavigation = (client: QueryClient) =>
  Promise.all([
    client.invalidateQueries({ queryKey: [...QUERY_KEY_ROOTS.favorites, "list"] }),
    client.invalidateQueries({ queryKey: [...QUERY_KEY_ROOTS.projects, "recent"] }),
    client.invalidateQueries({ queryKey: QUERY_KEY_ROOTS.globalSearch }),
  ]);
