import type { ProjectTreeItem } from "@lazuli/shared";

export const buildProjectChildren = (items: ProjectTreeItem[]) => {
  const children = new Map<string | null, ProjectTreeItem[]>();
  for (const item of items)
    children.set(item.parentId, [...(children.get(item.parentId) ?? []), item]);
  return children;
};

export const collectProjectDescendantIds = (items: ProjectTreeItem[], rootId: string) => {
  const children = buildProjectChildren(items);
  const ids = new Set<string>();
  const pending = [rootId];
  while (pending.length) {
    const id = pending.pop()!;
    if (ids.has(id)) continue;
    ids.add(id);
    pending.push(...(children.get(id) ?? []).map((item) => item.id));
  }
  return ids;
};
