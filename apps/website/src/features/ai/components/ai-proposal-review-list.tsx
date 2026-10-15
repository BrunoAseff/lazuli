import { WarningCircleIcon } from "@phosphor-icons/react/WarningCircle";
import { AI_MAX_REFERENCES_PER_ITEM } from "@lazuli/shared";
import { LinkSimpleIcon } from "@phosphor-icons/react/LinkSimple";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { ConfirmationDialog } from "@/components/confirmation-dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { documentLocation } from "@/features/documents/document-navigation.ts";
import { ReferenceDocumentRow } from "@/features/references/components/reference-document-row.tsx";
import { ConfirmReferenceRemovalButton } from "@/features/references/components/reference-delete-button.tsx";
import { cn } from "@/lib/utils.ts";
import type { AiReviewSource } from "../ai-review-session.ts";
import { AiQuizProposalEditor, type AiEditableQuizProposal } from "./ai-quiz-proposal-editor.tsx";

export type AiDraftReference = {
  scope: "selection" | "document";
  blockId: string | null;
  quote: string;
};

export type AiReviewFlashcard = {
  answer: string;
  evidence: string;
  id: string;
  question: string;
  references: AiDraftReference[];
  referenceWarning: string | null;
  selected: boolean;
  warning: string | null;
};

export type AiReviewQuiz = AiEditableQuizProposal & {
  evidence: string;
  id: string;
  selected: boolean;
  references: AiDraftReference[];
  referenceWarning: string | null;
  warning: string | null;
};

export const AiProposalReviewList = ({
  className,
  flashcards,
  onFlashcardChange,
  onNavigateReference,
  onQuizChange,
  onRemove,
  operationId,
  quizQuestions,
  returnTo,
  source,
}: {
  className?: string;
  flashcards: AiReviewFlashcard[];
  onFlashcardChange: (id: string, change: Partial<AiReviewFlashcard>) => void;
  onNavigateReference?: () => void;
  onQuizChange: (id: string, change: Partial<AiReviewQuiz>) => void;
  onRemove: (id: string, kind: "flashcard" | "quizQuestion") => void;
  operationId: string;
  quizQuestions: AiReviewQuiz[];
  returnTo: string;
  source: AiReviewSource;
}) => {
  const [discardTarget, setDiscardTarget] = useState<{
    id: string;
    kind: "flashcard" | "quizQuestion";
  } | null>(null);

  return (
    <>
      <div className={cn("grid gap-4", className)}>
        {flashcards.map((item, index) => (
          <article
            className={cn(
              "grid gap-4 rounded-[var(--radius)] border p-4 transition-opacity",
              !item.selected && "opacity-55",
            )}
            key={item.id}
          >
            <header className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 font-medium">
                <Checkbox
                  checked={item.selected}
                  onCheckedChange={(checked) =>
                    onFlashcardChange(item.id, { selected: checked === true })
                  }
                />
                Flashcard {index + 1}
              </label>
              <Button
                aria-label="Descartar proposta"
                onClick={() => setDiscardTarget({ id: item.id, kind: "flashcard" })}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Trash2Icon />
              </Button>
            </header>
            <div className="grid gap-2">
              <Label htmlFor={`question-${item.id}`}>Pergunta</Label>
              <Textarea
                id={`question-${item.id}`}
                onChange={(event) => onFlashcardChange(item.id, { question: event.target.value })}
                value={item.question}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`answer-${item.id}`}>Resposta</Label>
              <Textarea
                id={`answer-${item.id}`}
                onChange={(event) => onFlashcardChange(item.id, { answer: event.target.value })}
                value={item.answer}
              />
            </div>
            {item.warning && (
              <p className="flex gap-2 text-xs text-warning-foreground">
                <WarningCircleIcon className="size-4 shrink-0" /> {item.warning}
              </p>
            )}
            <ProposalReferences
              kind="flashcard"
              onChange={(references) => onFlashcardChange(item.id, { references })}
              onNavigate={onNavigateReference}
              operationId={operationId}
              proposalId={item.id}
              references={item.references}
              returnTo={returnTo}
              source={source}
              warning={item.referenceWarning}
            />
          </article>
        ))}

        {quizQuestions.map((item, index) => (
          <article
            className={cn(
              "grid gap-4 rounded-[var(--radius)] border p-4 transition-opacity",
              !item.selected && "opacity-55",
            )}
            key={item.id}
          >
            <header className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 font-medium">
                <Checkbox
                  checked={item.selected}
                  onCheckedChange={(checked) =>
                    onQuizChange(item.id, { selected: checked === true })
                  }
                />
                Questão {index + 1}
              </label>
              <Button
                aria-label="Descartar proposta"
                onClick={() => setDiscardTarget({ id: item.id, kind: "quizQuestion" })}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <Trash2Icon />
              </Button>
            </header>
            <AiQuizProposalEditor
              id={item.id}
              onChange={(change) => onQuizChange(item.id, change)}
              value={item}
            />
            {item.warning && (
              <p className="flex gap-2 text-xs text-warning-foreground">
                <WarningCircleIcon className="size-4 shrink-0" /> {item.warning}
              </p>
            )}
            <ProposalReferences
              kind="quizQuestion"
              onChange={(references) => onQuizChange(item.id, { references })}
              onNavigate={onNavigateReference}
              operationId={operationId}
              proposalId={item.id}
              references={item.references}
              returnTo={returnTo}
              source={source}
              warning={item.referenceWarning}
            />
          </article>
        ))}
      </div>
      <ConfirmationDialog
        actionLabel="Descartar proposta"
        description="Ela será removida desta revisão e não poderá ser recuperada. Os créditos da geração não serão devolvidos."
        destructive
        onConfirm={() => {
          if (!discardTarget) return;
          onRemove(discardTarget.id, discardTarget.kind);
          setDiscardTarget(null);
        }}
        onOpenChange={(nextOpen) => !nextOpen && setDiscardTarget(null)}
        open={Boolean(discardTarget)}
        title="Descartar esta proposta?"
      />
    </>
  );
};

const ProposalReferences = ({
  kind,
  onChange,
  onNavigate,
  operationId,
  proposalId,
  references,
  returnTo,
  source,
  warning,
}: {
  kind: "flashcard" | "quizQuestion";
  onChange: (references: AiDraftReference[]) => void;
  onNavigate?: () => void;
  operationId: string;
  proposalId: string;
  references: AiDraftReference[];
  returnTo: string;
  source: AiReviewSource;
  warning: string | null;
}) => {
  const [managerOpen, setManagerOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const count = references.length;
  const documentHref = (reference: AiDraftReference) =>
    documentLocation({
      blockId: reference.scope === "selection" ? reference.blockId : null,
      documentId: source.documentId,
      projectId: source.projectId,
      returnTo,
    });
  const selectExcerptHref = (referenceIndex: number) =>
    documentLocation({
      documentId: source.documentId,
      projectId: source.projectId,
      returnTo,
      params: {
        aiReferenceOperationId: operationId,
        aiReferenceProposalId: proposalId,
        aiReferenceKind: kind,
        aiReferenceIndex: String(referenceIndex),
        aiReferenceReturnTo: returnTo,
      },
    });
  const addDocumentReference = () => {
    if (references.some(({ scope }) => scope === "document")) return;
    onChange([...references, { scope: "document", blockId: null, quote: "" }]);
    setPickerOpen(false);
  };

  return (
    <section className="border-t py-4" aria-label="Referências sugeridas">
      <div className="flex min-h-8 items-center gap-2 text-xs text-muted-foreground">
        <LinkSimpleIcon className="size-4 text-primary" />
        <span className="flex-1">
          {count ? `${count} ${count === 1 ? "referência" : "referências"}` : "Sem referências"}
        </span>
        <Button onClick={() => setManagerOpen(true)} size="xs" type="button" variant="ghost">
          {count ? "Gerenciar" : "Adicionar"}
        </Button>
      </div>
      {warning && (
        <p className="mt-1 flex gap-2 text-xs text-warning-foreground">
          <WarningCircleIcon className="size-4 shrink-0" /> {warning}
        </p>
      )}

      <Dialog open={managerOpen} onOpenChange={setManagerOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="pr-8 text-xl">Referências</DialogTitle>
            <DialogDescription>Documentos conectados a este material.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto px-6 py-3 lazuli-thin-scrollbar">
            {!count && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhum documento vinculado.
              </p>
            )}
            <div className="divide-y">
              {references.map((reference, index) => (
                <ReferenceDocumentRow
                  documentTitle={source.documentTitle}
                  href={documentHref(reference)}
                  key={`${reference.scope}:${reference.blockId ?? "document"}:${index}`}
                  onNavigate={onNavigate}
                  projectTitle={source.projectTitle}
                  scope={reference.scope}
                  trailing={
                    <div className="flex shrink-0 items-center gap-1">
                      <Button asChild size="xs" type="button" variant="ghost">
                        <Link onClick={onNavigate} to={selectExcerptHref(index)}>
                          {reference.scope === "selection" ? "Ajustar trecho" : "Escolher trecho"}
                        </Link>
                      </Button>
                      {reference.scope === "selection" && (
                        <Button
                          onClick={() =>
                            onChange(
                              references.map((candidate, candidateIndex) =>
                                candidateIndex === index
                                  ? { scope: "document", blockId: null, quote: "" }
                                  : candidate,
                              ),
                            )
                          }
                          size="xs"
                          type="button"
                          variant="ghost"
                        >
                          Documento inteiro
                        </Button>
                      )}
                      <ConfirmReferenceRemovalButton
                        label={`Remover referência de ${source.documentTitle}`}
                        onConfirm={() =>
                          onChange(references.filter((_, candidate) => candidate !== index))
                        }
                      />
                    </div>
                  }
                />
              ))}
            </div>
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-none border-t px-6 py-4">
            <DialogCancelButton onClick={() => setManagerOpen(false)}>Fechar</DialogCancelButton>
            <Button
              disabled={references.length >= AI_MAX_REFERENCES_PER_ITEM}
              onClick={() => {
                setManagerOpen(false);
                setPickerOpen(true);
              }}
              type="button"
            >
              <PlusIcon aria-hidden="true" /> Adicionar referência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle className="pr-8 text-xl">Adicionar referência</DialogTitle>
            <DialogDescription>Escolha como este documento será relacionado.</DialogDescription>
          </DialogHeader>
          <div className="px-6 py-3">
            <ReferenceDocumentRow
              documentTitle={source.documentTitle}
              href={documentLocation({
                documentId: source.documentId,
                projectId: source.projectId,
                returnTo,
              })}
              onNavigate={onNavigate}
              projectTitle={source.projectTitle}
              scope="document"
            />
          </div>
          <DialogFooter className="mx-0 mb-0 rounded-none border-t px-6 py-4 sm:flex-wrap">
            <DialogCancelButton onClick={() => setPickerOpen(false)}>Cancelar</DialogCancelButton>
            <Button asChild type="button" variant="outline">
              <Link onClick={onNavigate} to={selectExcerptHref(references.length)}>
                Escolher um trecho
              </Link>
            </Button>
            <Button
              disabled={references.some(({ scope }) => scope === "document")}
              onClick={addDocumentReference}
              type="button"
            >
              Vincular documento inteiro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
