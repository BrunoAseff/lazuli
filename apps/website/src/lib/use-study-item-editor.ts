import { useEffect, useState } from "react";

import type { PendingStudyEditorState, StudyEditorState } from "./study-editor.ts";

type UpdateParams = (
  changes: Record<string, string | undefined>,
  resetPage?: boolean,
  replace?: boolean,
) => void;

/**
 * The item editor of a collection page (a flashcard or a question): what is open, mirrored in the
 * URL (`?card=` / `?question=`), and the "discard changes?" step when leaving unsaved edits.
 */
export const useStudyItemEditor = ({
  linkedId,
  onChange,
  param,
  updateParams,
}: {
  /** The item the URL names ("new" for a new one), opened when it changes. */
  linkedId: string | null;
  /** Runs when the person moves to another item (e.g. drop a duplicate draft). */
  onChange?: () => void;
  param: "card" | "question";
  updateParams: UpdateParams;
}) => {
  const [editor, setEditor] = useState<StudyEditorState>(null);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<PendingStudyEditorState>(null);

  useEffect(() => {
    if (linkedId)
      setEditor(linkedId === "new" ? { type: "create" } : { type: "edit", id: linkedId });
  }, [linkedId]);

  /** Shows `next` and writes it to the URL; `replace` keeps history clean for automatic moves. */
  const show = (next: StudyEditorState, replace = false) => {
    setEditor(next);
    updateParams(
      { [param]: next ? (next.type === "create" ? "new" : next.id) : undefined },
      false,
      replace,
    );
  };

  /** The person asks for another item: unsaved edits ask first. */
  const change = (next: Exclude<StudyEditorState, null>) => {
    if (dirty) return setPending(next);
    onChange?.();
    show(next);
  };

  const close = () => {
    if (dirty) return setPending("close");
    show(null, true);
  };

  /** After the open item left the list (archived, moved, deleted): the next one, or nothing. */
  const showReplacement = (replacementId?: string) =>
    show(replacementId ? { type: "edit", id: replacementId } : null, true);

  return {
    activeId: editor?.type === "edit" ? editor.id : undefined,
    change,
    close,
    editor,
    setDirty,
    show,
    showReplacement,
    /** Props for the "Descartar alterações?" confirmation. */
    discard: {
      open: Boolean(pending),
      onOpenChange: (open: boolean) => {
        if (!open) setPending(null);
      },
      onConfirm: () => {
        if (!pending) return;
        const next = pending;
        setPending(null);
        setDirty(false);
        if (next === "close") show(null, true);
        else {
          onChange?.();
          show(next);
        }
      },
    },
  };
};
