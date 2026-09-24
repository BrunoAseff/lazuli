import { useRef, useState } from "react";
import { toast } from "sonner";

export type StudyCollectionAction = "archive" | "delete" | "edit";

export const useStudyCollectionActions = <Collection extends { id: string }>({
  getRestoreErrorMessage,
  restore,
}: {
  getRestoreErrorMessage: (error: unknown) => string;
  restore: (collectionId: string) => Promise<unknown>;
}) => {
  const [activeAction, setActiveAction] = useState<{
    action: StudyCollectionAction;
    collection: Collection;
  } | null>(null);
  const restoringIds = useRef(new Set<string>());

  const handleAction = async (
    action: StudyCollectionAction | "restore",
    collection: Collection,
  ) => {
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
