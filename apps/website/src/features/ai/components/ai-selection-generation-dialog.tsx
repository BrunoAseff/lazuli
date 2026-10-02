import {
  AI_CREDITS_PER_ITEM,
  AI_SELECTION_MAX_ITEMS,
  type AiMaterialKind,
  type AiSelectionDraft,
  type DocumentBlock,
} from "@lazuli/shared";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/ArrowClockwise";
import { CircleNotchIcon } from "@phosphor-icons/react/CircleNotch";
import { CoinsIcon } from "@phosphor-icons/react/Coins";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { ConfirmationDialog } from "@/components/confirmation-dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { useFlashcardCollections } from "@/features/flashcards/api/flashcard-collection-queries.ts";
import { useQuizCollections } from "@/features/quizzes/api/quiz-collection-queries.ts";
import { hasDuplicateQuizOptionTexts } from "@/features/quizzes/components/quiz-alternatives-field.tsx";
import type { AiEditableQuizProposal } from "./ai-quiz-proposal-editor.tsx";
import { AiProposalReviewList } from "./ai-proposal-review-list.tsx";
import { getApiErrorMessage } from "@/lib/api-client.ts";
import { cn } from "@/lib/utils.ts";
import {
  useAiCreditBalance,
  useAiGeneration,
  useApproveAiGeneration,
  useCreateAiSelectionGeneration,
} from "../api/ai-queries.ts";

export type AiSelectionAction = {
  anchorId: string | null;
  anchorCreated: boolean;
  selectedText: string;
  sourceScope: "document" | "image" | "selection";
  sourceBlockIds: string[];
};

type EditableFlashcard = AiSelectionDraft["flashcards"][number] & { selected: boolean };
type EditableQuiz = AiSelectionDraft["quizQuestions"][number] &
  AiEditableQuizProposal & { selected: boolean };
type DiscardTarget = { id: string; kind: AiMaterialKind } | null;

const textContent = (text: string): DocumentBlock[] => [
  {
    id: crypto.randomUUID(),
    type: "paragraph",
    content: [{ type: "text", text: text.trim(), styles: {} }],
  },
];

const generationMessages = {
  AI_INPUT_TOO_LARGE:
    "Este documento é grande demais para uma única geração. Selecione um trecho menor.",
  AI_INSUFFICIENT_CREDITS: "Você não possui créditos suficientes para esta geração.",
  AI_RATE_LIMITED: "Muitas gerações foram solicitadas. Aguarde um pouco e tente novamente.",
  AI_REGENERATION_LIMIT: "O limite de três novas tentativas foi atingido.",
  AI_SOURCE_CHANGED: "O trecho mudou. Selecione-o novamente no documento.",
} as const;

export const AiSelectionGenerationDialog = ({
  action,
  documentId,
  documentRevision,
  getDocumentContent,
  open,
  onApproved,
  onCancel,
  onMinimize,
}: {
  action: AiSelectionAction | null;
  documentId: string;
  documentRevision: number;
  getDocumentContent: () => DocumentBlock[];
  open: boolean;
  onApproved: (revision: number) => void;
  onCancel: () => void;
  onMinimize: () => void;
}) => {
  const navigate = useNavigate();
  const [kind, setKind] = useState<AiMaterialKind>("flashcard");
  const [collectionId, setCollectionId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [guidance, setGuidance] = useState("");
  const [operationId, setOperationId] = useState("");
  const [draft, setDraft] = useState<AiSelectionDraft | null>(null);
  const [flashcards, setFlashcards] = useState<EditableFlashcard[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<EditableQuiz[]>([]);
  const [discardTarget, setDiscardTarget] = useState<DiscardTarget>(null);
  const [regenerationConfirmationOpen, setRegenerationConfirmationOpen] = useState(false);
  const [sourceExpanded, setSourceExpanded] = useState(false);
  const balance = useAiCreditBalance();
  const flashcardCollections = useFlashcardCollections(
    { page: 1, pageSize: 24, query: "", status: "active" },
    kind === "flashcard",
  );
  const quizCollections = useQuizCollections(
    { page: 1, pageSize: 24, query: "", status: "active" },
    kind === "quizQuestion",
  );
  const createGeneration = useCreateAiSelectionGeneration();
  const generation = useAiGeneration(operationId);
  const approve = useApproveAiGeneration(operationId);
  const collections = useMemo(
    () =>
      kind === "flashcard"
        ? (flashcardCollections.data?.items ?? [])
        : (quizCollections.data?.items ?? []),
    [flashcardCollections.data?.items, kind, quizCollections.data?.items],
  );
  const appliedOperationId = useRef("");
  const cost = quantity * AI_CREDITS_PER_ITEM;

  useEffect(() => {
    setCollectionId((current) =>
      current && collections.some(({ id }) => id === current)
        ? current
        : (collections[0]?.id ?? ""),
    );
  }, [collections]);

  useEffect(() => {
    if (!action) {
      setOperationId("");
      setDraft(null);
      setFlashcards([]);
      setQuizQuestions([]);
      setGuidance("");
      setQuantity(1);
      setDiscardTarget(null);
      setRegenerationConfirmationOpen(false);
      setSourceExpanded(false);
      appliedOperationId.current = "";
    }
  }, [action]);

  useEffect(() => {
    const result = generation.data;
    if (result?.status !== "completed") return;
    if (appliedOperationId.current === result.draft.operationId) return;
    appliedOperationId.current = result.draft.operationId;
    setDraft(result.draft);
    setFlashcards(result.draft.flashcards.map((item) => ({ ...item, selected: true })));
    setQuizQuestions(result.draft.quizQuestions.map((item) => ({ ...item, selected: true })));
  }, [generation.data]);

  const selectedCount = useMemo(
    () =>
      (draft?.kind === "flashcard" ? flashcards : quizQuestions).filter(({ selected }) => selected)
        .length,
    [draft?.kind, flashcards, quizQuestions],
  );
  const selectedQuizHasDuplicateOptions = quizQuestions.some(
    ({ options, selected }) => selected && hasDuplicateQuizOptionTexts(options),
  );

  const clearGenerationUrl = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete("aiGeneration");
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${params.size ? `?${params}` : ""}`,
    );
  };

  const requestGeneration = async (regenerateOperationId?: string) => {
    if (!action || !collectionId) return;
    try {
      const commonInput = {
        idempotencyKey: crypto.randomUUID(),
        documentId,
        expectedRevision: documentRevision,
        kind,
        collectionId,
        quantity,
        guidance,
        regenerateOperationId,
      };
      const result = await createGeneration.mutateAsync(
        action.sourceScope === "selection"
          ? {
              ...commonInput,
              anchorId: action.anchorId!,
              selectedText: action.selectedText,
              sourceScope: "selection",
              sourceBlockIds: action.sourceBlockIds,
            }
          : action.sourceScope === "image"
            ? {
                ...commonInput,
                anchorId: action.anchorId!,
                selectedText: "" as const,
                sourceScope: "image" as const,
                sourceBlockIds: action.sourceBlockIds as [string],
              }
            : {
                ...commonInput,
                anchorId: null,
                selectedText: "",
                sourceScope: "document",
                sourceBlockIds: [],
              },
      );
      const nextOperationId =
        result.status === "completed" ? result.draft.operationId : result.operationId;
      setOperationId(nextOperationId);
      const params = new URLSearchParams(window.location.search);
      params.set("aiGeneration", nextOperationId);
      window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
      if (result.status === "completed") {
        setDraft(result.draft);
        setFlashcards(result.draft.flashcards.map((item) => ({ ...item, selected: true })));
        setQuizQuestions(result.draft.quizQuestions.map((item) => ({ ...item, selected: true })));
      }
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Não foi possível gerar os materiais.", generationMessages),
      );
    }
  };

  const save = async () => {
    if (!draft || selectedCount === 0) return;
    try {
      const result = await approve.mutateAsync({
        expectedRevision: documentRevision,
        anchoredContent: getDocumentContent(),
        flashcards:
          draft.kind === "flashcard"
            ? flashcards
                .filter(({ selected }) => selected)
                .map(({ answer, id, question }) => ({
                  id,
                  question: textContent(question),
                  answer: textContent(answer),
                }))
            : [],
        quizQuestions:
          draft.kind === "quizQuestion"
            ? quizQuestions
                .filter(({ selected }) => selected)
                .map(({ content, correctOptionIndex, id, options, prompt }) => ({
                  id,
                  content: content ?? textContent(prompt),
                  options: options.map((text, index) => ({
                    id: crypto.randomUUID(),
                    text,
                    isCorrect: index === correctOptionIndex,
                  })),
                }))
            : [],
      });
      clearGenerationUrl();
      const collectionPath =
        draft.kind === "flashcard"
          ? `/flashcards/${draft.collectionId}`
          : `/quizzes/${draft.collectionId}`;
      const destination =
        result.createdIds.length === 1
          ? `${collectionPath}?${draft.kind === "flashcard" ? "card" : "question"}=${result.createdIds[0]}`
          : collectionPath;
      toast.success(
        `${result.createdIds.length} ${result.createdIds.length === 1 ? "material criado" : "materiais criados"} e conectado à fonte.`,
        {
          action: {
            label: result.createdIds.length === 1 ? "Ver material" : "Ver coleção",
            onClick: () => void navigate(destination),
          },
        },
      );
      onApproved(result.revision);
    } catch (error) {
      toast.error(
        getApiErrorMessage(error, "Não foi possível salvar os materiais.", generationMessages),
      );
    }
  };

  const close = () => {
    if (createGeneration.isPending || approve.isPending) return;
    if (draft && flashcards.length + quizQuestions.length > 0) onMinimize();
    else onCancel();
  };

  return (
    <>
      <Dialog open={open && Boolean(action)} onOpenChange={(nextOpen) => !nextOpen && close()}>
        <DialogContent className="max-h-[calc(100vh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="border-b px-6 py-5">
            <DialogTitle>Geração de conteúdo</DialogTitle>
            <DialogDescription>
              {draft
                ? "Revise e ajuste cada proposta antes de criar os materiais."
                : action?.sourceScope === "document"
                  ? "Transforme este documento em materiais de estudo editáveis."
                  : action?.sourceScope === "image"
                    ? "Transforme a imagem selecionada em materiais de estudo editáveis."
                    : "Transforme o trecho selecionado em materiais de estudo editáveis."}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 overflow-y-auto px-6 py-5 lazuli-thin-scrollbar">
            {!draft ? (
              <div className="grid gap-5">
                <section className="rounded-[var(--radius)] border bg-muted/25 p-4">
                  <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {action?.sourceScope === "document"
                      ? "Documento inteiro"
                      : action?.sourceScope === "image"
                        ? "Imagem selecionada"
                        : "Trecho selecionado"}
                  </p>
                  <div
                    className={cn(
                      "leading-relaxed",
                      sourceExpanded
                        ? "max-h-[min(40vh,20rem)] overflow-y-auto pr-2 lazuli-thin-scrollbar"
                        : "line-clamp-4",
                    )}
                  >
                    {action?.selectedText}
                  </div>
                  {(action?.selectedText.length ?? 0) > 280 && (
                    <Button
                      className="mt-2 h-auto px-0 py-0"
                      onClick={() => setSourceExpanded((current) => !current)}
                      variant="link"
                    >
                      {sourceExpanded ? "Ver menos" : "Ver texto completo"}
                    </Button>
                  )}
                </section>

                <div className="grid gap-2">
                  <Label>Tipo de material</Label>
                  <Tabs value={kind} onValueChange={(value) => setKind(value as AiMaterialKind)}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="flashcard">Flashcards</TabsTrigger>
                      <TabsTrigger value="quizQuestion">Questões</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ai-collection">Coleção</Label>
                  <Select value={collectionId} onValueChange={setCollectionId}>
                    <SelectTrigger className="w-full" id="ai-collection">
                      <SelectValue placeholder="Selecione uma coleção" />
                    </SelectTrigger>
                    <SelectContent>
                      {collections.map((collection) => (
                        <SelectItem key={collection.id} value={collection.id}>
                          {collection.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!collections.length && (
                    <p className="text-xs text-destructive">
                      Crie uma coleção de {kind === "flashcard" ? "flashcards" : "quizzes"} antes de
                      gerar.
                    </p>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label>Quantidade</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {Array.from({ length: AI_SELECTION_MAX_ITEMS }, (_, index) => index + 1).map(
                      (value) => (
                        <Button
                          key={value}
                          onClick={() => setQuantity(value)}
                          size="sm"
                          type="button"
                          variant={quantity === value ? "default" : "outline"}
                        >
                          {value}
                        </Button>
                      ),
                    )}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="ai-guidance">Orientação (opcional)</Label>
                  <Textarea
                    id="ai-guidance"
                    maxLength={500}
                    onChange={(event) => setGuidance(event.target.value)}
                    placeholder="Ex.: priorize conceitos e evite perguntas sobre datas."
                    rows={3}
                    value={guidance}
                  />
                </div>

                <div className="flex items-center gap-3 rounded-[var(--radius)] bg-muted/35 px-4 py-3 text-sm">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <CoinsIcon aria-hidden="true" className="size-5" weight="duotone" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-6 gap-y-1">
                    <span>Custo: {cost} créditos</span>
                    <span className="text-muted-foreground">
                      Saldo: {balance.data?.available ?? "…"} créditos
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {draft.flashcards.length + draft.quizQuestions.length} propostas geradas
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {draft.consumedCredits} créditos consumidos · {selectedCount} selecionadas
                    </p>
                  </div>
                  <Button
                    disabled={createGeneration.isPending || draft.regenerationCount >= 3}
                    onClick={() => setRegenerationConfirmationOpen(true)}
                    size="sm"
                    variant="outline"
                  >
                    <ArrowClockwiseIcon /> Gerar novamente
                  </Button>
                </div>

                <AiProposalReviewList
                  flashcards={flashcards}
                  onFlashcardChange={(id, change) =>
                    setFlashcards((current) =>
                      current.map((item) => (item.id === id ? { ...item, ...change } : item)),
                    )
                  }
                  onQuizChange={(id, change) =>
                    setQuizQuestions((current) =>
                      current.map((item) => (item.id === id ? { ...item, ...change } : item)),
                    )
                  }
                  onRemove={(id, kind) => setDiscardTarget({ id, kind })}
                  quizQuestions={quizQuestions}
                />
              </div>
            )}

            {(createGeneration.isPending || generation.data?.status === "running") && (
              <div className="absolute inset-0 grid place-items-center bg-background/80 backdrop-blur-sm">
                <div className="text-center">
                  <CircleNotchIcon className="mx-auto mb-3 size-7 animate-spin text-primary" />
                  <p className="font-medium">Criando propostas…</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Você pode fechar e continuar depois.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mx-0 mb-0 shrink-0 rounded-none border-t px-6 py-4">
            <Button
              className="w-full min-w-0 shrink sm:w-auto"
              disabled={createGeneration.isPending || approve.isPending}
              onClick={close}
              type="button"
              variant="outline"
            >
              {draft ? "Fechar" : "Cancelar"}
            </Button>
            {draft ? (
              <Button
                className="w-full min-w-0 shrink sm:w-auto"
                disabled={
                  approve.isPending ||
                  selectedCount === 0 ||
                  flashcards.some(({ answer, question, selected }) =>
                    selected ? !answer.trim() || !question.trim() : false,
                  ) ||
                  quizQuestions.some(({ options, prompt, selected }) =>
                    selected ? !prompt.trim() || options.some((option) => !option.trim()) : false,
                  ) ||
                  selectedQuizHasDuplicateOptions
                }
                onClick={() => void save()}
              >
                {approve.isPending && <CircleNotchIcon className="animate-spin" />}
                Salvar {selectedCount} {selectedCount === 1 ? "material" : "materiais"}
              </Button>
            ) : (
              <Button
                className="w-full min-w-0 shrink sm:w-auto"
                disabled={
                  createGeneration.isPending ||
                  !collectionId ||
                  balance.data === undefined ||
                  balance.data.available < cost
                }
                onClick={() => void requestGeneration()}
              >
                Gerar propostas
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmationDialog
        actionLabel="Gerar novamente"
        description="As propostas atuais serão substituídas. Esta tentativa está incluída e não consumirá novos créditos."
        onConfirm={async () => {
          setRegenerationConfirmationOpen(false);
          if (draft) await requestGeneration(draft.operationId);
        }}
        onOpenChange={setRegenerationConfirmationOpen}
        open={regenerationConfirmationOpen}
        title="Substituir as propostas atuais?"
      />
      <ConfirmationDialog
        actionLabel="Descartar proposta"
        description="Ela será removida desta revisão e não poderá ser recuperada. Os créditos da geração não são devolvidos."
        destructive
        onConfirm={() => {
          if (!discardTarget) return;
          const remainingCount = flashcards.length + quizQuestions.length - 1;
          if (discardTarget.kind === "flashcard")
            setFlashcards((current) => current.filter(({ id }) => id !== discardTarget.id));
          if (discardTarget.kind === "quizQuestion")
            setQuizQuestions((current) => current.filter(({ id }) => id !== discardTarget.id));
          setDiscardTarget(null);
          if (remainingCount === 0) {
            clearGenerationUrl();
            setDraft(null);
            onCancel();
          }
        }}
        onOpenChange={(nextOpen) => !nextOpen && setDiscardTarget(null)}
        open={Boolean(discardTarget)}
        title="Descartar esta proposta?"
      />
    </>
  );
};
