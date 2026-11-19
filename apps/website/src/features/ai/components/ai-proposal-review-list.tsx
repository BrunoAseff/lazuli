import { WarningCircleIcon } from "@/components/icons.tsx";
import { AI_MAX_REFERENCES_PER_ITEM } from "@lazuli/shared";
import {
  FileTextIcon,
  MoreHorizontalIcon,
  PencilSimpleIcon,
  TextQuoteIcon,
  Trash2Icon,
} from "@/components/icons.tsx";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router";

import { ConfirmationDialog } from "@/components/confirmation-dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { documentLocation } from "@/features/documents/document-navigation.ts";
import { studyItemAgreement, studyItemCount } from "@/lib/text.ts";
import { cn } from "@/lib/utils.ts";
import { StudyIndexList, StudyIndexRow } from "@/components/study-index.tsx";
import { useSourceReading } from "@/features/references/components/source-reading-context.ts";
import "./proposal-review.css";
import type { AiReviewSource } from "../ai-review-session.ts";
import { AiQuizProposalEditor, type AiEditableQuizProposal } from "./ai-quiz-proposal-editor.tsx";

export type AiDraftReference = {
  scope: "selection" | "document";
  /** Another document of a generation over several; absent or null is the review's own. */
  documentId: string | null;
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
  const [activeProposal, setActiveProposal] = useState("");
  const proposals = [
    ...flashcards.map((item) => ({
      value: `flashcard:${item.id}`,
      selected: item.selected,
      title: item.question.trim(),
      attention: Boolean(item.warning || item.referenceWarning),
    })),
    ...quizQuestions.map((item) => ({
      value: `quizQuestion:${item.id}`,
      selected: item.selected,
      title: item.prompt.trim(),
      attention: Boolean(item.warning || item.referenceWarning),
    })),
  ];
  const active = proposals.some(({ value }) => value === activeProposal)
    ? activeProposal
    : proposals[0]?.value;
  const activeIndex = proposals.findIndex(({ value }) => value === active);

  return (
    <>
      <div className={cn("grid gap-4", className)}>
        <ProposalIndex
          activeIndex={activeIndex}
          itemLabel={flashcards.length ? "Flashcard" : "Questão"}
          onSelect={(index) => setActiveProposal(proposals[index]!.value)}
          proposals={proposals}
        />
        {flashcards
          .filter((item) => active === `flashcard:${item.id}`)
          .map((item) => (
            <article className="proposal" data-excluded={!item.selected || undefined} key={item.id}>
              <ProposalHeader
                included={item.selected}
                label={`Flashcard ${flashcards.findIndex(({ id }) => id === item.id) + 1}`}
                onDiscard={() => setDiscardTarget({ id: item.id, kind: "flashcard" })}
                onIncludedChange={(selected) => onFlashcardChange(item.id, { selected })}
                total={proposals.length}
              />
              <ProposalSource
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
                <p className="flex gap-2 text-xs text-warning">
                  <WarningCircleIcon className="size-4 shrink-0" /> {item.warning}
                </p>
              )}
            </article>
          ))}

        {quizQuestions
          .filter((item) => active === `quizQuestion:${item.id}`)
          .map((item) => (
            <article className="proposal" data-excluded={!item.selected || undefined} key={item.id}>
              <ProposalHeader
                included={item.selected}
                label={`Questão ${quizQuestions.findIndex(({ id }) => id === item.id) + 1}`}
                onDiscard={() => setDiscardTarget({ id: item.id, kind: "quizQuestion" })}
                onIncludedChange={(selected) => onQuizChange(item.id, { selected })}
                total={proposals.length}
              />
              <ProposalSource
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
              <AiQuizProposalEditor
                id={item.id}
                onChange={(change) => onQuizChange(item.id, change)}
                value={item}
              />
              {item.warning && (
                <p className="flex gap-2 text-xs text-warning">
                  <WarningCircleIcon className="size-4 shrink-0" /> {item.warning}
                </p>
              )}
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

/**
 * The proposals as an index, with the anatomy of the workbench: number, the text itself and what
 * will be kept. It occupies the workspace's left pane, so navigation reads as a list of questions.
 */
const ProposalIndex = ({
  activeIndex,
  itemLabel,
  onSelect,
  proposals,
}: {
  activeIndex: number;
  itemLabel: string;
  onSelect: (index: number) => void;
  proposals: { value: string; selected: boolean; title: string; attention: boolean }[];
}) => {
  const workspace = useSourceReading();
  const kept = proposals.filter(({ selected }) => selected).length;
  const flashcard = itemLabel === "Flashcard";
  const kind = flashcard ? "flashcard" : "quizQuestion";
  const name = studyItemCount(kind, proposals.length);
  const claim = workspace?.claim;
  useEffect(() => {
    claim?.(name);
  }, [claim, name]);
  useEffect(() => () => claim?.(null), [claim]);
  const content = (
    <nav aria-label="Propostas geradas" className="proposal-index">
      <header className="proposal-index-head">
        <span>{name}</span>
        <span>
          {proposals.length === 1
            ? kept
              ? `será ${studyItemAgreement(kind, 1, "salv")}`
              : `não será ${studyItemAgreement(kind, 1, "salv")}`
            : kept === proposals.length
              ? `${flashcard ? "todos" : "todas"} serão ${studyItemAgreement(kind, kept, "salv")}`
              : `${kept} ${kept === 1 ? "será" : "serão"} ${studyItemAgreement(kind, kept, "salv")}`}
        </span>
      </header>
      <StudyIndexList label="Propostas geradas" selecting={false}>
        {proposals.map((proposal, index) => (
          <StudyIndexRow
            active={index === activeIndex}
            key={proposal.value}
            mark={<span className="study-index-ordinal">{index + 1}</span>}
            /* Only what changes the decision: left out, or flagged by the generator. */
            meta={
              !proposal.selected ? (
                "Fora da coleção"
              ) : proposal.attention ? (
                <span className="text-warning">Precisa de revisão</span>
              ) : undefined
            }
            muted={!proposal.selected}
            onOpen={() => {
              onSelect(index);
              workspace?.collapse();
            }}
            title={proposal.title || `${itemLabel} ${index + 1}`}
            titleText={proposal.title || undefined}
          />
        ))}
      </StudyIndexList>
    </nav>
  );
  // Inside a workspace the index lives only in its pane; when that pane is collapsed, nothing renders.
  if (!workspace) return content;
  return workspace.slot ? createPortal(content, workspace.slot) : null;
};

/** One header for every proposal: position, inclusion as an explicit switch, discard. */
const ProposalHeader = ({
  included,
  label,
  onDiscard,
  onIncludedChange,
  total,
}: {
  included: boolean;
  label: string;
  onDiscard: () => void;
  onIncludedChange: (included: boolean) => void;
  total: number;
}) => (
  <>
    <header className="proposal-head">
      <h3>
        {label}
        {total > 1 && <span> de {total}</span>}
      </h3>
      <label className="proposal-include">
        <Switch checked={included} onCheckedChange={onIncludedChange} />
        Salvar na coleção
      </label>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            aria-label="Descartar proposta"
            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={onDiscard}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Trash2Icon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Descartar proposta</TooltipContent>
      </Tooltip>
    </header>
  </>
);

/**
 * The source pane of the workspace shows the origin of the proposal being reviewed:
 * only the excerpt when there is one, the whole source when the proposal uses all of it.
 * Its actions live there too, so the source never appears twice.
 */
const ProposalSource = ({
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
  const [removing, setRemoving] = useState<number | null>(null);
  const excerpts = references.filter(({ scope, quote }) => scope === "selection" && quote);
  const showsExcerpt = excerpts.length > 0;
  const documentOf = (reference?: AiDraftReference) => reference?.documentId || source.documentId;
  const titleOf = (documentId: string) =>
    documentId === source.documentId
      ? source.documentTitle
      : (source.documents?.find((item) => item.documentId === documentId)?.documentTitle ??
        "Documento");
  // A proposal that draws on more than one document says so: it links ideas across them.
  const linkedDocuments = [...new Set(references.map((reference) => documentOf(reference)))];
  const documentHref = (reference: AiDraftReference) =>
    documentLocation({
      blockId: reference.scope === "selection" ? reference.blockId : null,
      documentId: documentOf(reference),
      projectId: source.projectId,
      returnTo,
    });
  const selectExcerptHref = (referenceIndex: number) =>
    documentLocation({
      documentId: documentOf(references[referenceIndex]),
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
  const firstExcerpt = excerpts[0];
  const content = (
    // Named like the fields below it ("Fonte", "Pergunta", "Resposta"); only the excerpt takes the
    // source's tinted block, as in the preparation step.
    <section aria-labelledby={`${proposalId}-source`} className="proposal-source">
      <p className="text-sm leading-none font-medium" id={`${proposalId}-source`}>
        Fonte
      </p>
      <header className="proposal-source-head">
        <FileTextIcon aria-hidden="true" className="proposal-source-icon" />
        <p className="proposal-source-title">
          {!references.length
            ? "Sem fonte"
            : linkedDocuments.length > 1
              ? `Liga ${linkedDocuments.length} documentos`
              : titleOf(linkedDocuments[0]!)}
          {references.length > 0 && linkedDocuments.length === 1 && (
            <span>
              {showsExcerpt
                ? excerpts.length === 1
                  ? " · trecho"
                  : ` · ${excerpts.length} trechos`
                : " · documento inteiro"}
            </span>
          )}
        </p>
        {references[0] && (
          <Button asChild className="proposal-source-open" size="xs" variant="outline">
            <Link onClick={onNavigate} to={documentHref(references[0])}>
              Ver no documento
            </Link>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button aria-label="Ações da fonte" size="icon-sm" variant="ghost">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            {references.length < AI_MAX_REFERENCES_PER_ITEM && (
              <DropdownMenuItem asChild>
                <Link onClick={onNavigate} to={selectExcerptHref(references.length)}>
                  <TextQuoteIcon /> {references.length ? "Adicionar trecho" : "Escolher trecho"}
                </Link>
              </DropdownMenuItem>
            )}
            {references.map((reference, index) =>
              reference.scope === "selection" ? (
                <DropdownMenuItem asChild key={`adjust:${index}`}>
                  <Link onClick={onNavigate} to={selectExcerptHref(index)}>
                    <PencilSimpleIcon />{" "}
                    {excerpts.length > 1 ? `Ajustar trecho ${index + 1}` : "Ajustar trecho"}
                  </Link>
                </DropdownMenuItem>
              ) : null,
            )}
            {!references.some(({ scope: referenceScope }) => referenceScope === "document") && (
              <DropdownMenuItem
                onSelect={() =>
                  onChange([{ scope: "document", documentId: null, blockId: null, quote: "" }])
                }
              >
                <FileTextIcon /> Usar o documento inteiro
              </DropdownMenuItem>
            )}
            {references.length > 0 && (
              <>
                <DropdownMenuSeparator />
                {references.map((_, index) => (
                  <DropdownMenuItem
                    key={`remove:${index}`}
                    onSelect={() => setRemoving(index)}
                    variant="destructive"
                  >
                    <Trash2Icon />{" "}
                    {references.length > 1 ? `Remover fonte ${index + 1}` : "Remover fonte"}
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>
      {/* A pointer to the source, not the source itself: two lines at most, same height for every proposal. */}
      {/* The clamp lives on the text, not on the padded block, so the cut ends in "…". */}
      {linkedDocuments.length > 1 ? (
        // Linking documents: one passage from each, under the document it comes from.
        <div className="grid gap-2.5">
          {excerpts.map((excerpt, index) => (
            <div className="grid gap-1" key={`${documentOf(excerpt)}:${index}`}>
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <FileTextIcon aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="truncate">{titleOf(documentOf(excerpt))}</span>
              </span>
              <div className="source-excerpt">
                <p className="proposal-source-quote">{excerpt.quote}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="source-excerpt">
          <p className="proposal-source-quote" data-empty={!firstExcerpt || undefined}>
            {firstExcerpt
              ? firstExcerpt.quote
              : references.length
                ? "A proposta foi gerada a partir do documento todo."
                : "Esta proposta será salva sem ligação com a fonte."}
          </p>
        </div>
      )}
      {warning && (
        <p className="mt-2 flex gap-2 font-sans text-xs text-warning">
          <WarningCircleIcon className="size-4 shrink-0" /> {warning}
        </p>
      )}
      <ConfirmationDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null);
        }}
        title="Remover esta fonte?"
        description="A proposta continuará na revisão, mas perderá esta conexão com o documento."
        actionLabel="Remover fonte"
        destructive
        onConfirm={() => {
          onChange(references.filter((_, index) => index !== removing));
          setRemoving(null);
        }}
      />
    </section>
  );
  return content;
};
