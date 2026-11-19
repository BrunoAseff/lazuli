import { type ReferenceSource } from "@lazuli/shared";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { FlashcardEditorDialog } from "@/features/flashcards/components/flashcard-editor-sheet.tsx";
import { QuizQuestionDialog } from "@/features/quizzes/components/quiz-question-dialog.tsx";
import { useCreateReferences } from "../api/reference-queries.ts";
import type { DocumentMaterialAction } from "./document-formatting-toolbar.tsx";

export const DocumentMaterialFlow = ({
  action,
  documentId,
  onCancel,
  onComplete,
  persistDocument,
}: {
  action: DocumentMaterialAction | null;
  documentId: string;
  onCancel: () => void;
  onComplete: () => void;
  persistDocument: () => Promise<boolean>;
}) => {
  const completed = useRef(false);
  useEffect(() => {
    completed.current = false;
  }, [action?.anchorId]);
  const source: ReferenceSource | undefined = action
    ? { type: "selection", documentId, anchorId: action.anchorId }
    : undefined;
  const createReference = useCreateReferences();
  const connect = async (targetId: string) => {
    if (!action || !source) return false;
    try {
      if (!(await persistDocument())) return false;
      await createReference.mutateAsync({
        source,
        targets: [{ type: action.kind, id: targetId }],
      });
      completed.current = true;
      toast.success(
        action.kind === "flashcard"
          ? "Flashcard criado e conectado ao trecho."
          : "Questão criada e conectada ao trecho.",
      );
      onComplete();
      return true;
    } catch {
      toast.error(
        action.kind === "flashcard"
          ? "O flashcard não pôde ser conectado. Tente novamente."
          : "A questão não pôde ser conectada. Tente novamente.",
      );
      onCancel();
      return false;
    }
  };

  if (!action) return null;
  if (action.kind === "flashcard")
    return (
      <FlashcardEditorDialog
        key={action.anchorId}
        onCreated={connect}
        onOpenChange={(open) => !open && !completed.current && onCancel()}
        open
        sourcePreview={action.selectedText}
      />
    );
  return (
    <QuizQuestionDialog
      key={action.anchorId}
      onCreated={connect}
      onOpenChange={(open) => !open && !completed.current && onCancel()}
      open
      sourcePreview={action.selectedText}
    />
  );
};
