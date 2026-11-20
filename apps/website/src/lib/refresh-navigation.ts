import type { QueryClient } from "@tanstack/react-query";

/**
 * The sidebar's favorites and recent projects, and search, show titles too: after a rename (or a
 * collection archived, restored or deleted) they are read again, so no reload is needed.
 */
export const refreshNavigation = (client: QueryClient) =>
  Promise.all([
    client.invalidateQueries({ queryKey: ["favorites", "list"] }),
    client.invalidateQueries({ queryKey: ["projects", "recent"] }),
    client.invalidateQueries({ queryKey: ["global-search"] }),
  ]);
