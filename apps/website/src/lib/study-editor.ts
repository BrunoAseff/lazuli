export type StudyEditorPresentation = "dialog" | "panel";

export type StudyEditorState = { type: "create" } | { id: string; type: "edit" } | null;

export type PendingStudyEditorState = Exclude<StudyEditorState, null> | "close" | null;

export const findReplacementStudyItemId = (
  items: readonly { id: string }[],
  activeId: string | undefined,
  excluded: ReadonlySet<string>,
) => {
  const activeIndex = items.findIndex(({ id }) => id === activeId);
  const candidates =
    activeIndex >= 0 ? [...items.slice(activeIndex + 1), ...items.slice(0, activeIndex)] : items;
  return candidates.find(({ id }) => !excluded.has(id))?.id;
};
