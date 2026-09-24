import { useRef, useState } from "react";
import { toast } from "sonner";

import type { StudyCollectionAction } from "@/lib/study-actions.ts";

type PendingStudyCollectionAction = Exclude<StudyCollectionAction, "restore">;

export const useStudyCollectionActions = <Collection extends { id: string }>({
  getRestoreErrorMessage,
  restore,
}: {
  getRestoreErrorMessage: (error: unknown) => string;
  restore: (collectionId: string) => Promise<unknown>;
}) => {
  const [activeAction, setActiveAction] = useState<{
    action: PendingStudyCollectionAction;
    collection: Collection;
  } | null>(null);
  const restoringIds = useRef(new Set<string>());

  const handleAction = async (action: StudyCollectionAction, collection: Collection) => {
    if (action !== "restore") {
      setActiveAction({ action, collection });
      return;
    }
    if (restoringIds.current.has(collection.id)) return;
    restoringIds.current.add(collection.id);
    try {
      await restore(collection.id);
      toast.success("Coleção restaurada.");
    } catch (error) {
      toast.error(getRestoreErrorMessage(error));
    } finally {
      restoringIds.current.delete(collection.id);
    }
  };

  return { activeAction, handleAction, setActiveAction };
};
