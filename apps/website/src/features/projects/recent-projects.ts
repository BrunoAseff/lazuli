const RECENT_PROJECT_LIMIT = 4;

export type RecentProject = {
  id: string;
  lastOpenedAt: string;
  title: string;
};

const isRecentProject = (value: unknown): value is RecentProject => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RecentProject>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.lastOpenedAt === "string"
  );
};

export const recentProjectsStorageKey = (userId: string) => `lazuli-recent-projects:${userId}`;

export const readRecentProjects = (storage: Storage, userId: string): RecentProject[] => {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(recentProjectsStorageKey(userId)) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecentProject).slice(0, RECENT_PROJECT_LIMIT);
  } catch {
    return [];
  }
};

export const rememberRecentProject = (
  current: RecentProject[],
  project: Pick<RecentProject, "id" | "title">,
  openedAt = new Date().toISOString(),
): RecentProject[] => {
  const existingIndex = current.findIndex(({ id }) => id === project.id);

  if (existingIndex === -1) {
    return [{ ...project, lastOpenedAt: openedAt }, ...current].slice(0, RECENT_PROJECT_LIMIT);
  }

  return current.map((recentProject, index) =>
    index === existingIndex ? { ...project, lastOpenedAt: openedAt } : recentProject,
  );
};

export const writeRecentProjects = (storage: Storage, userId: string, projects: RecentProject[]) =>
  storage.setItem(recentProjectsStorageKey(userId), JSON.stringify(projects));
