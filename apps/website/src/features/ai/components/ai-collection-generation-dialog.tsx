import {
  AI_DOCUMENT_MAX_BLOCKS,
  AI_DOCUMENT_MAX_TEXT_LENGTH,
  AI_COLLECTION_MAX_ITEMS,
  AI_CREDITS_PER_ITEM,
  AI_MAX_ADDITIONAL_SOURCES,
  AI_MAX_AVOIDED_ITEMS,
  collectDocumentTextBlocks,
  getDocumentBlockText,
  PROJECT_MAX_PAGE_SIZE,
  type AiCollectionDraft,
  type AiMaterialKind,
  type DocumentBlock,
} from "@lazuli/shared";
import { CircleNotchIcon } from "@/components/icons.tsx";
import { AiCreditCost } from "./ai-credit-cost.tsx";
import { CreationWorkspace } from "./creation-workspace.tsx";
import { SourceReading } from "@/features/references/components/source-reading.tsx";
import { QuantitySelector } from "@/components/quantity-selector.tsx";
import { MagicWandIcon, PlusIcon, Trash2Icon } from "@/components/icons.tsx";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { DocumentDomainIcon } from "@/components/domain-icons.ts";
import { StudyCollectionDestination } from "@/components/study-collection-destination.tsx";
import { ViewSelector } from "@/components/view-selector.tsx";
import { useFlashcardCollections } from "@/features/flashcards/api/flashcard-collection-queries.ts";
import { useQuizCollections } from "@/features/quizzes/api/quiz-collection-queries.ts";
import { ConfirmationDialog } from "@/components/confirmation-dialog.tsx";
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
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import { useDocument, useProjectTree } from "@/features/documents/api/document-queries.ts";
import { CreditUpgradeGuard } from "@/features/billing/components/credit-upgrade-guard.tsx";
import { useProjects } from "@/features/projects/api/project-queries.ts";
import { hasDuplicateQuizOptionTexts } from "@/features/quizzes/components/quiz-alternatives-field.tsx";
import { studyItemAgreement, studyItemCount } from "@/lib/text.ts";
import { getApiErrorMessage } from "@/lib/api-client.ts";
import { AutoHeight } from "@/components/auto-height.tsx";
import { GemLoader } from "@/components/brand-mark.tsx";
import { MorphText } from "@/components/motion/morph-text.tsx";
import { cn } from "@/lib/utils.ts";
import {
  clearAiReviewSession,
  readAiReviewSession,
  writeAiReviewSession,
} from "../ai-review-session.ts";
import type { AiEditableQuizProposal } from "./ai-quiz-proposal-editor.tsx";
import { AiProposalReviewList } from "./ai-proposal-review-list.tsx";
import { createAiCollectionGeneration } from "../api/ai-api.ts";
import {
  useAiCollectionGeneration,
  useAiCreditBalance,
  useApproveAiGeneration,
  useCreateAiCollectionGeneration,
  useDiscardAiCollectionGeneration,
  useLatestAiCollectionGeneration,
} from "../api/ai-queries.ts";

/** `origin` is the generation a proposal came from when it is not the draft's own ("Gerar mais"). */
type EditableFlashcard = AiCollectionDraft["flashcards"][number] & {
  origin?: string;
  selected: boolean;
};
type EditableQuiz = AiCollectionDraft["quizQuestions"][number] &
  AiEditableQuizProposal & { origin?: string; selected: boolean };

/**
 * "Gerar mais": under the proposal list, a button that opens the choice of how many more, with
 * the cost, and generates only on confirming. The new batch reads the same sources and is told
 * what is already in the list.
 */
const GenerateMore = ({
  available,
  kind,
  onGenerate,
  pending,
}: {
  available?: number;
  kind: AiMaterialKind;
  onGenerate: (quantity: number) => void;
  pending: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(5);
  const plural = kind === "flashcard" ? "flashcards" : "questões";
  const cost = quantity * AI_CREDITS_PER_ITEM;
  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button className="w-full" disabled={pending} size="sm" variant="outline">
          {pending ? <CircleNotchIcon className="animate-spin" /> : <PlusIcon aria-hidden="true" />}
          {pending ? `Gerando mais ${plural}…` : `Gerar mais ${plural}`}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="grid w-[24rem] max-w-[calc(100vw-2rem)] gap-4 p-4"
        side="top"
      >
        <div>
          <p className="text-sm font-semibold">Gerar mais {plural}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            A IA lê as mesmas fontes e evita repetir o que já está na lista.{" "}
            {kind === "flashcard" ? "Os novos entram" : "As novas entram"} no fim dela.
          </p>
        </div>
        <div className="grid gap-2">
          <Label asChild>
            <p>{kind === "flashcard" ? "Quantos?" : "Quantas?"}</p>
          </Label>
          <QuantitySelector
            label="Quantidade de propostas novas"
            onChange={setQuantity}
            options={Array.from({ length: AI_COLLECTION_MAX_ITEMS }, (_, index) => index + 1)}
            value={quantity}
          />
        </div>
        <div className="flex items-center justify-between gap-3">
          <AiCreditCost available={available} cost={cost} />
          <Button
            disabled={(available ?? 0) < cost}
            onClick={() => {
              setOpen(false);
              onGenerate(quantity);
            }}
            size="sm"
          >
            <MagicWandIcon /> Gerar {studyItemCount(kind, quantity)}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const textContent = (text: string): DocumentBlock[] => [
  {
    id: crypto.randomUUID(),
    type: "paragraph",
    content: [{ type: "text", text: text.trim(), styles: {} }],
  },
];

const sectionOptions = (content: DocumentBlock[]) =>
  content.flatMap((block, index) => {
    if (block.type !== "heading") return [];
    const level = Number((block.props as { level?: unknown } | undefined)?.level ?? 1);
    const ids = [block.id];
    for (let cursor = index + 1; cursor < content.length; cursor += 1) {
      const candidate = content[cursor]!;
      if (
        candidate.type === "heading" &&
        Number((candidate.props as { level?: unknown } | undefined)?.level ?? 1) <= level
      )
        break;
      ids.push(candidate.id);
    }
    return [{ id: block.id, ids, title: getDocumentBlockText(block) || "Seção sem título" }];
  });

type SourceInfo = {
  /** The text blocks this source contributes (one section or the whole document). */
  sourceBlockIds: string[];
  ready: boolean;
  revision: number;
  words: number;
};

const isEqualInfo = (left: SourceInfo | undefined, right: SourceInfo) =>
  Boolean(left) &&
  left!.ready === right.ready &&
  left!.revision === right.revision &&
  left!.words === right.words &&
  left!.sourceBlockIds.join() === right.sourceBlockIds.join();

const fitsOneGeneration = (blocks: Array<{ text: string }>) =>
  blocks.length > 0 &&
  blocks.length <= AI_DOCUMENT_MAX_BLOCKS &&
  blocks.map(({ text }) => text).join(" ").length <= AI_DOCUMENT_MAX_TEXT_LENGTH;

const wordCount = (blocks: Array<{ text: string }>) =>
  blocks.reduce((total, { text }) => total + (text.match(/\S+/g)?.length ?? 0), 0);

/** One proposal per ~300 words, between 1 and the most a generation makes. */
const suggestedQuantity = (words: number) =>
  Math.max(1, Math.min(AI_COLLECTION_MAX_ITEMS, Math.round(words / 300)));

/**
 * What a marked document contributes: the whole of it when it fits one generation, else one of its
 * sections, chosen here. It reports that up, so the dialog can size the batch and send the request.
 */
const SourceScope = ({
  documentId,
  onInfo,
  onSection,
  projectId,
  sectionId,
  title,
}: {
  documentId: string;
  onInfo: (documentId: string, info: SourceInfo) => void;
  onSection: (documentId: string, sectionId: string) => void;
  projectId: string;
  sectionId: string;
  title: string;
}) => {
  const fieldId = useId();
  const document = useDocument(projectId, documentId);
  const content = (document.data?.content ?? []) as DocumentBlock[];
  const blocks = useMemo(() => collectDocumentTextBlocks(content), [document.data?.content]);
  const sections = useMemo(() => sectionOptions(content), [document.data?.content]);
  const whole = fitsOneGeneration(blocks);
  const section = sections.find(({ id }) => id === sectionId);
  const sectionBlocks = useMemo(() => {
    const ids = new Set(section?.ids ?? []);
    return blocks.filter(({ id }) => ids.has(id));
  }, [blocks, section]);
  const sectionFits = fitsOneGeneration(sectionBlocks);
  const loaded = Boolean(document.data);
  useEffect(() => {
    onInfo(documentId, {
      ready: loaded && (whole || sectionFits),
      revision: document.data?.revision ?? 0,
      sourceBlockIds: whole ? [] : (section?.ids ?? []),
      words: wordCount(whole ? blocks : sectionBlocks),
    });
  }, [
    blocks,
    document.data?.revision,
    documentId,
    loaded,
    onInfo,
    section,
    sectionBlocks,
    sectionFits,
    whole,
  ]);
  useEffect(() => {
    if (loaded && !whole && !sections.some(({ id }) => id === sectionId))
      onSection(documentId, sections[0]?.id ?? "");
  }, [documentId, loaded, onSection, sectionId, sections, whole]);
  if (!loaded || whole) return null;
  return (
    <div className="grid gap-1.5 pb-2.5 pl-[2.375rem] pr-3">
      {sections.length ? (
        <>
          <Label className="sr-only" htmlFor={fieldId}>
            Seção de {title}
          </Label>
          <Select value={sectionId} onValueChange={(value) => onSection(documentId, value)}>
            <SelectTrigger className="w-full" id={fieldId}>
              <SelectValue placeholder="Selecione uma seção" />
            </SelectTrigger>
            <SelectContent className={fieldListClass}>
              {sections.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {section && !sectionFits
              ? "Esta seção ainda é muito extensa. Escolha uma seção menor."
              : "Documento grande demais para uma geração: escolha uma seção."}
          </p>
        </>
      ) : (
        <p className="text-xs text-destructive">
          Documento grande demais e sem seções reconhecidas. Divida-o com títulos antes de gerar.
        </p>
      )}
    </div>
  );
};

const MAX_SOURCES = AI_MAX_ADDITIONAL_SOURCES + 1;

/**
 * The project's documents, all in view, to mark as sources: no hidden "add" step. A marked
 * document too large for one generation asks for a section right under it.
 */
const SourceChecklist = ({
  documents,
  onInfo,
  onSection,
  onToggle,
  projectId,
  sections,
  selected,
}: {
  documents: Array<{ id: string; title: string }>;
  onInfo: (documentId: string, info: SourceInfo) => void;
  onSection: (documentId: string, sectionId: string) => void;
  onToggle: (documentId: string, checked: boolean) => void;
  projectId: string;
  sections: Record<string, string>;
  selected: string[];
}) => (
  <div className="max-h-60 overflow-y-auto rounded-[var(--radius)] border border-input lazuli-thin-scrollbar">
    {documents.map((item) => {
      const checked = selected.includes(item.id);
      const full = !checked && selected.length >= MAX_SOURCES;
      return (
        <div className="border-b border-border/60 last:border-b-0" key={item.id}>
          {/* The label sits beside the box, not around it: a button inside a label gets the click
              twice and would undo itself. */}
          <div className="flex items-center gap-3 px-3 has-[:disabled]:opacity-55">
            <Checkbox
              checked={checked}
              disabled={full}
              id={`source-${item.id}`}
              onCheckedChange={(value) => onToggle(item.id, value === true)}
            />
            <label
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-2.5"
              htmlFor={`source-${item.id}`}
              title={full ? `Até ${MAX_SOURCES} documentos por geração` : undefined}
            >
              <DocumentDomainIcon
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />
              <span className="min-w-0 truncate">{item.title}</span>
            </label>
          </div>
          {checked && (
            <SourceScope
              documentId={item.id}
              onInfo={onInfo}
              onSection={onSection}
              projectId={projectId}
              sectionId={sections[item.id] ?? ""}
              title={item.title}
            />
          )}
        </div>
      );
    })}
  </div>
);

/**
 * The one dialog for creating materials with AI from documents, wherever it opens: the same
 * questions in the same order (sources, what to create, how many, where to save). Each entry only
 * fills in what it already knows: a collection fixes the kind and the destination, a document or
 * a project its sources.
 */
export const AiCollectionGenerationDialog = ({
  collectionId: fixedCollectionId,
  defaultDocumentIds,
  defaultProjectId,
  kind: fixedKind,
  onApproved,
  onOperationChange,
  onOpenChange,
  open,
  resumeOperationId,
}: {
  /** Opened from a collection: it is the destination, and its kind is the kind. */
  collectionId?: string;
  /** Opened from a document: it starts as the source. */
  defaultDocumentIds?: string[];
  /** The project whose documents can be sources. */
  defaultProjectId?: string | null;
  kind?: AiMaterialKind;
  /** Saving anchors passages in the source documents; an open editor takes the new version. */
  onApproved?: () => void;
  /** The generation in progress or waiting for review; null once saved or discarded. */
  onOperationChange?: (operationId: string | null) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** A generation started here earlier and not yet saved: reopening goes back to it. */
  resumeOperationId?: string | null;
}) => {
  const fieldsId = useId();
  const [kind, setKind] = useState<AiMaterialKind>(fixedKind ?? "flashcard");
  const [chosenCollectionId, setChosenCollectionId] = useState("");
  const collectionId = fixedCollectionId ?? chosenCollectionId;
  const [projectId, setProjectId] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [sections, setSections] = useState<Record<string, string>>({});
  const [infos, setInfos] = useState<Record<string, SourceInfo>>({});
  const [quantity, setQuantity] = useState(5);
  const [quantityTouched, setQuantityTouched] = useState(false);
  const [guidance, setGuidance] = useState("");
  const [guidanceOpen, setGuidanceOpen] = useState(false);
  const [operationId, setOperationId] = useState("");
  const [discardOpen, setDiscardOpen] = useState(false);
  const [draft, setDraft] = useState<AiCollectionDraft | null>(null);
  const [flashcards, setFlashcards] = useState<EditableFlashcard[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<EditableQuiz[]>([]);
  const location = useLocation();
  const appliedOperationId = useRef("");
  const projects = useProjects(
    { page: 1, pageSize: PROJECT_MAX_PAGE_SIZE, query: "" },
    open && !draft,
  );
  const tree = useProjectTree(projectId, open && Boolean(projectId) && !draft);
  const balance = useAiCreditBalance();
  // Only a collection's own entry resumes its latest generation; elsewhere a new one starts.
  const latest = useLatestAiCollectionGeneration(
    fixedCollectionId ?? "",
    open && Boolean(fixedCollectionId) && !operationId,
  );
  const generation = useAiCollectionGeneration(operationId);
  // "Gerar mais": another batch from the same sources, told what was already proposed.
  const [moreOperationId, setMoreOperationId] = useState("");
  const more = useAiCollectionGeneration(moreOperationId);
  const appliedMore = useRef(new Set<string>());
  const create = useCreateAiCollectionGeneration(collectionId);
  const discard = useDiscardAiCollectionGeneration(collectionId);
  const approve = useApproveAiGeneration(operationId || draft?.operationId || "");
  const projectFlashcards = useFlashcardCollections(
    { page: 1, pageSize: 1, project: projectId, query: "", status: "active" },
    open && !fixedCollectionId && Boolean(projectId) && kind === "flashcard",
  );
  const projectQuizzes = useQuizCollections(
    { page: 1, pageSize: 1, project: projectId, query: "", status: "active" },
    open && !fixedCollectionId && Boolean(projectId) && kind === "quizQuestion",
  );
  const documents = (tree.data?.items ?? []).filter((item) => item.type === "document");
  const projectTitle = projects.data?.items.find((item) => item.id === projectId)?.title;
  const sourceInfos = sources.map((id) => infos[id]);
  const sourcesReady = sources.length > 0 && sourceInfos.every((info) => info?.ready);
  const words = sourceInfos.reduce((total, info) => total + (info?.words ?? 0), 0);
  const suggestion = suggestedQuantity(words);
  const result = operationId ? generation.data : latest.data;
  const queryError = operationId ? generation.error : latest.error;
  const busy = !queryError && (result?.status === "queued" || result?.status === "processing");
  const selectedCount =
    kind === "flashcard"
      ? flashcards.filter(({ selected }) => selected).length
      : quizQuestions.filter(({ selected }) => selected).length;
  const cost = quantity * AI_CREDITS_PER_ITEM;
  const reviewSource = (value: AiCollectionDraft) => ({
    documentId: value.documentId,
    documentTitle: value.documentTitle,
    projectId: value.projectId ?? "",
    projectTitle: value.projectTitle,
    documents: value.additionalSources.map(({ documentId, documentTitle }) => ({
      documentId,
      documentTitle,
    })),
  });
  const persistReview = () => {
    if (!draft?.projectId) return;
    writeAiReviewSession(draft.operationId, {
      flashcards,
      quizQuestions,
      source: reviewSource(draft),
    });
  };
  const onInfo = useCallback(
    (documentId: string, info: SourceInfo) =>
      setInfos((current) =>
        isEqualInfo(current[documentId], info) ? current : { ...current, [documentId]: info },
      ),
    [],
  );
  const onSection = useCallback(
    (documentId: string, sectionId: string) =>
      setSections((current) =>
        current[documentId] === sectionId ? current : { ...current, [documentId]: sectionId },
      ),
    [],
  );

  // A fresh form each time it opens without a generation in flight.
  useEffect(() => {
    if (!open || draft || operationId) return;
    if (resumeOperationId) {
      setOperationId(resumeOperationId);
      return;
    }
    setKind(fixedKind ?? "flashcard");
    setProjectId(defaultProjectId ?? "");
    setSources(defaultDocumentIds ?? []);
    setSections({});
    setQuantityTouched(false);
    setChosenCollectionId("");
    // Reset only when the dialog opens; later prop changes must not wipe the user's choices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!quantityTouched && words) setQuantity(suggestion);
  }, [quantityTouched, suggestion, words]);

  // Where to save starts at the project's own collection of that kind, when it has one.
  const projectCollectionId =
    kind === "flashcard" ? projectFlashcards.data?.items[0]?.id : projectQuizzes.data?.items[0]?.id;
  useEffect(() => {
    if (!fixedCollectionId && !chosenCollectionId && projectCollectionId)
      setChosenCollectionId(projectCollectionId);
  }, [chosenCollectionId, fixedCollectionId, projectCollectionId]);

  useEffect(() => {
    if (!open || result?.status !== "completed") return;
    if (appliedOperationId.current === result.draft.operationId) return;
    appliedOperationId.current = result.draft.operationId;
    setDraft(result.draft);
    setKind(result.draft.kind);
    setOperationId(result.draft.operationId);
    // A saved review with nothing in it is no review: start again from the draft's proposals.
    const stored = readAiReviewSession(result.draft.operationId);
    const saved =
      stored && stored.flashcards.length + stored.quizQuestions.length > 0 ? stored : null;
    setFlashcards(
      (saved?.flashcards as EditableFlashcard[] | undefined) ??
        result.draft.flashcards.map((item) => ({ ...item, selected: true })),
    );
    setQuizQuestions(
      (saved?.quizQuestions as EditableQuiz[] | undefined) ??
        result.draft.quizQuestions.map((item) => ({ ...item, selected: true })),
    );
  }, [open, result]);

  useEffect(() => {
    // Only a draft whose proposals are in the list is saved, never an empty list before them.
    if (!draft || !draft.projectId || appliedOperationId.current !== draft.operationId) return;
    persistReview();
  }, [draft, flashcards, quizQuestions]);

  useEffect(() => {
    if (!moreOperationId) return;
    if (more.error) {
      toast.error(getApiErrorMessage(more.error, "Não foi possível gerar mais propostas."));
      setMoreOperationId("");
      return;
    }
    if (more.data?.status !== "completed") return;
    const origin = more.data.draft.operationId;
    // A batch is added once, however many times its result is seen.
    if (appliedMore.current.has(origin)) return;
    appliedMore.current.add(origin);
    const added = more.data.draft;
    setFlashcards((items) => [
      ...items,
      ...added.flashcards.map((item) => ({ ...item, origin, selected: true })),
    ]);
    setQuizQuestions((items) => [
      ...items,
      ...added.quizQuestions.map((item) => ({ ...item, origin, selected: true })),
    ]);
    const count = added.flashcards.length + added.quizQuestions.length;
    toast.success(
      count
        ? `${count} ${count === 1 ? "proposta nova" : "propostas novas"} no fim da lista.`
        : "A fonte não tem conceitos novos para mais propostas.",
    );
    setMoreOperationId("");
  }, [more.data, more.error, moreOperationId]);

  const requestMore = async (moreQuantity: number) => {
    if (!draft) return;
    const avoid = [
      ...flashcards.map(({ question }) => question),
      ...quizQuestions.map(({ prompt }) => prompt),
    ]
      .map((text) => text.trim().slice(0, 500))
      .filter(Boolean)
      .slice(0, AI_MAX_AVOIDED_ITEMS);
    try {
      // Straight to the API: this batch must not become the collection's resumable draft.
      const response = await createAiCollectionGeneration({
        idempotencyKey: crypto.randomUUID(),
        documentId: draft.documentId,
        expectedRevision: draft.documentRevision,
        kind: draft.kind,
        collectionId: draft.collectionId,
        quantity: moreQuantity,
        guidance: "",
        sourceBlockIds: draft.sourceScope === "section" ? draft.sourceBlockIds : [],
        additionalSources: draft.additionalSources.map(({ documentId, sourceBlockIds }) => ({
          documentId,
          sourceBlockIds,
        })),
        avoid,
        continuesOperationId: draft.operationId,
      });
      if (response.status === "completed") setMoreOperationId(response.draft.operationId);
      else if (response.status !== "none") setMoreOperationId(response.operationId);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível gerar mais propostas."));
    }
  };

  const requestGeneration = async () => {
    const [first, ...others] = sources;
    const firstInfo = first ? infos[first] : undefined;
    if (!first || !firstInfo || !sourcesReady || !collectionId) return;
    try {
      const response = await create.mutateAsync({
        idempotencyKey: crypto.randomUUID(),
        documentId: first,
        expectedRevision: firstInfo.revision,
        kind,
        collectionId,
        quantity,
        guidance,
        sourceBlockIds: firstInfo.sourceBlockIds,
        additionalSources: others.map((documentId) => ({
          documentId,
          sourceBlockIds: infos[documentId]?.sourceBlockIds ?? [],
        })),
        avoid: [],
      });
      if (response.status === "completed") {
        // A new generation always starts queued: a finished draft is the one this collection was
        // already waiting with. Say so, and open it as it is.
        toast.info(
          "Esta coleção já tinha propostas esperando revisão. Salve ou descarte antes de gerar outras.",
        );
        setOperationId(response.draft.operationId);
        onOperationChange?.(response.draft.operationId);
      } else if (response.status !== "none") {
        setOperationId(response.operationId);
        onOperationChange?.(response.operationId);
      }
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível iniciar a geração."));
    }
  };

  const changeProject = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    setSources([]);
    setSections({});
    setChosenCollectionId("");
  };

  const save = async () => {
    if (!draft || !selectedCount) return;
    const references = (items: EditableFlashcard["references"]) =>
      items.filter(({ quote, scope }) => scope === "document" || quote.trim());
    // Proposals of each generation are saved under that generation, the draft's own first.
    const origins = [
      ...new Set([
        draft.operationId,
        ...[...flashcards, ...quizQuestions]
          .map(({ origin }) => origin)
          .filter((origin): origin is string => Boolean(origin)),
      ]),
    ];
    let created = 0;
    for (const origin of origins) {
      const ownFlashcards = flashcards.filter(
        (item) => item.selected && (item.origin ?? draft.operationId) === origin,
      );
      const ownQuizzes = quizQuestions.filter(
        (item) => item.selected && (item.origin ?? draft.operationId) === origin,
      );
      if (!ownFlashcards.length && !ownQuizzes.length) continue;
      try {
        const saved = await approve.mutateAsync({
          operationId: origin,
          expectedRevision: draft.documentRevision,
          flashcards: ownFlashcards.map(({ answer, id, question, references: items }) => ({
            id,
            question: textContent(question),
            answer: textContent(answer),
            references: references(items),
          })),
          quizQuestions: ownQuizzes.map(
            ({ content, correctOptionIndex, id, options, prompt, references: items }) => ({
              id,
              content: content ?? textContent(prompt),
              options: options.map((text, index) => ({
                id: crypto.randomUUID(),
                text,
                isCorrect: index === correctOptionIndex,
              })),
              references: references(items),
            }),
          ),
        });
        created += saved.createdIds.length;
        // What is saved leaves the review, so a failure later never saves it twice.
        const savedIds = new Set(saved.createdIds);
        setFlashcards((items) => items.filter(({ id }) => !savedIds.has(id)));
        setQuizQuestions((items) => items.filter(({ id }) => !savedIds.has(id)));
      } catch (error) {
        if (created)
          toast.success(
            `${studyItemCount(kind, created)} ${studyItemAgreement(kind, created, "adicionad")} à coleção.`,
          );
        toast.error(getApiErrorMessage(error, "Não foi possível salvar os materiais."));
        return;
      }
    }
    toast.success(
      `${studyItemCount(kind, created)} ${studyItemAgreement(kind, created, "adicionad")} à coleção.`,
    );
    clearAiReviewSession(draft.operationId);
    appliedOperationId.current = "";
    setDraft(null);
    setOperationId("");
    onOpenChange(false);
    onOperationChange?.(null);
    onApproved?.();
  };

  const discardDraft = async () => {
    if (!draft) return false;
    try {
      await discard.mutateAsync(draft.operationId);
      // Batches added with "Gerar mais" go too; one already gone is no reason to stop.
      const origins = new Set(
        [...flashcards, ...quizQuestions]
          .map(({ origin }) => origin)
          .filter((origin): origin is string => Boolean(origin) && origin !== draft.operationId),
      );
      await Promise.allSettled([...origins].map((origin) => discard.mutateAsync(origin)));
      clearAiReviewSession(draft.operationId);
      appliedOperationId.current = "";
      setDraft(null);
      setOperationId("");
      setFlashcards([]);
      setQuizQuestions([]);
      setDiscardOpen(false);
      onOperationChange?.(null);
      onOpenChange(false);
      return true;
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Não foi possível descartar este rascunho."));
      return false;
    }
  };

  const invalid =
    flashcards.some(({ answer, question, selected }) =>
      selected ? !answer.trim() || !question.trim() : false,
    ) ||
    quizQuestions.some(({ correctOptionIndex, options, prompt, selected }) =>
      selected
        ? !prompt.trim() ||
          correctOptionIndex < 0 ||
          options.some((option) => !option.trim()) ||
          hasDuplicateQuizOptionTexts(options)
        : false,
    );
  const reviewReturnTo = draft
    ? `${location.pathname}?${new URLSearchParams({ aiGeneration: draft.operationId })}`
    : `${location.pathname}${location.search}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "grid max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0",
          // Preparing is a short form in one column; reviewing needs the source beside it.
          draft ? "sm:max-w-5xl" : "sm:max-w-lg",
        )}
      >
        <DialogHeader className={draft ? "border-b px-6 py-5" : "px-6 pt-6"}>
          <DialogTitle>
            {draft
              ? "Revisar propostas"
              : !fixedKind
                ? "Criar materiais com IA"
                : fixedKind === "flashcard"
                  ? "Criar flashcards com IA"
                  : "Criar questões com IA"}
          </DialogTitle>
          <DialogDescription>
            {draft
              ? "Ajuste o texto, desligue o que não quer salvar ou descarte. Só o que estiver ligado entra na coleção."
              : "Você revisa as propostas antes de salvar. A geração continua mesmo se você sair desta página."}
          </DialogDescription>
        </DialogHeader>
        <div
          className={cn(
            "min-h-0 overflow-y-auto lazuli-thin-scrollbar",
            draft ? "px-6 py-5 md:overflow-hidden" : "px-6 pt-5 pb-6",
          )}
        >
          {draft ? (
            <CreationWorkspace
              reviewing
              source={
                <div className="grid gap-6">
                  {[
                    {
                      documentId: draft.documentId,
                      documentTitle: draft.documentTitle,
                      sourceText: draft.sourceText,
                    },
                    ...draft.additionalSources,
                  ].map((item) => (
                    <div key={item.documentId}>
                      <h3>{item.documentTitle}</h3>
                      <SourceReading text={item.sourceText} />
                    </div>
                  ))}
                </div>
              }
            >
              <AiProposalReviewList
                flashcards={flashcards}
                indexFooter={
                  <GenerateMore
                    available={balance.data?.available}
                    kind={kind}
                    onGenerate={(quantity) => void requestMore(quantity)}
                    pending={Boolean(moreOperationId)}
                  />
                }
                onFlashcardChange={(id, change) =>
                  setFlashcards((items) =>
                    items.map((item) => (item.id === id ? { ...item, ...change } : item)),
                  )
                }
                onNavigateReference={persistReview}
                onQuizChange={(id, change) =>
                  setQuizQuestions((items) =>
                    items.map((item) => (item.id === id ? { ...item, ...change } : item)),
                  )
                }
                onRemove={(id, kind) => {
                  // Removing the last proposal leaves nothing to review: discard the draft and close,
                  // instead of an empty review that offers to "save 0".
                  if (flashcards.length + quizQuestions.length <= 1) {
                    void discardDraft().then(
                      (done) => done && toast.success("Propostas descartadas."),
                    );
                    return;
                  }
                  if (kind === "flashcard")
                    setFlashcards((items) => items.filter((item) => item.id !== id));
                  else setQuizQuestions((items) => items.filter((item) => item.id !== id));
                }}
                operationId={draft.operationId}
                quizQuestions={quizQuestions}
                returnTo={reviewReturnTo}
                source={reviewSource(draft)}
              />
            </CreationWorkspace>
          ) : queryError ? (
            <div className="grid min-h-72 place-items-center text-center">
              <div className="max-w-sm">
                <p className="font-medium">Não foi possível concluir esta geração</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {getApiErrorMessage(queryError, "Tente iniciar uma nova geração.")}
                </p>
              </div>
            </div>
          ) : busy ? (
            <GenerationPending />
          ) : (
            <AutoHeight className="-m-1">
              <div className="grid gap-5 p-1 text-sm">
                {!defaultProjectId && (
                  <div className="grid gap-2">
                    <Label htmlFor={`${fieldsId}-project`}>Projeto</Label>
                    <Select value={projectId} onValueChange={changeProject}>
                      <SelectTrigger
                        className="w-full"
                        id={`${fieldsId}-project`}
                        title={projectTitle}
                      >
                        <SelectValue placeholder="Selecione um projeto" />
                      </SelectTrigger>
                      <SelectContent className={fieldListClass}>
                        {projects.data?.items.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {projectId && (
                  <div className="grid gap-2">
                    <Label asChild>
                      <p>Fontes</p>
                    </Label>
                    {tree.isSuccess && documents.length === 0 ? (
                      <p className="text-muted-foreground">
                        Este projeto ainda não tem documentos.
                      </p>
                    ) : (
                      <SourceChecklist
                        documents={documents}
                        onInfo={onInfo}
                        onSection={onSection}
                        onToggle={(documentId, checked) =>
                          setSources((current) =>
                            checked
                              ? [...current, documentId].slice(0, MAX_SOURCES)
                              : current.filter((id) => id !== documentId),
                          )
                        }
                        projectId={projectId}
                        sections={sections}
                        selected={sources}
                      />
                    )}
                    <p className="text-xs text-muted-foreground">
                      {sources.length > 1
                        ? "Além de itens de cada documento, a IA pode juntar ideias de mais de um, só quando um trecho de cada sustenta isso."
                        : `Marque um ou mais documentos do projeto, até ${MAX_SOURCES}.`}
                    </p>
                  </div>
                )}
                {!fixedKind && (
                  <div className="grid gap-2">
                    <Label asChild>
                      <p>O que criar?</p>
                    </Label>
                    <ViewSelector
                      fullWidth
                      label="O que criar"
                      onChange={(next) => {
                        setKind(next as AiMaterialKind);
                        setChosenCollectionId("");
                      }}
                      options={[
                        { value: "flashcard", label: "Flashcards" },
                        { value: "quizQuestion", label: "Questões" },
                      ]}
                      value={kind}
                    />
                  </div>
                )}
                <div className="grid gap-2">
                  <Label asChild>
                    <p>{kind === "flashcard" ? "Quantos?" : "Quantas?"}</p>
                  </Label>
                  <QuantitySelector
                    label="Quantidade de propostas"
                    onChange={(value) => {
                      setQuantity(value);
                      setQuantityTouched(true);
                    }}
                    options={Array.from(
                      { length: AI_COLLECTION_MAX_ITEMS },
                      (_, index) => index + 1,
                    )}
                    value={quantity}
                  />
                  {words > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {suggestion} {suggestion === 1 ? "sugerido" : "sugeridos"} para cerca de{" "}
                      {words.toLocaleString("pt-BR")} palavras. Depois de revisar, dá para gerar
                      mais.
                    </p>
                  )}
                </div>
                {!fixedCollectionId && (
                  <StudyCollectionDestination
                    key={kind}
                    kind={kind}
                    label="Salvar em"
                    onChange={setChosenCollectionId}
                    value={chosenCollectionId}
                  />
                )}
                {/* Optional guidance stays out of the way until wanted. */}
                {guidanceOpen || guidance ? (
                  <div className="grid gap-2">
                    <Label htmlFor={`${fieldsId}-guidance`}>
                      Orientação para a IA{" "}
                      <span className="font-normal text-muted-foreground">Opcional</span>
                    </Label>
                    <Textarea
                      autoFocus={guidanceOpen && !guidance}
                      id={`${fieldsId}-guidance`}
                      maxLength={500}
                      onChange={(event) => setGuidance(event.target.value)}
                      placeholder="Ex.: priorize conceitos centrais e varie o nível das perguntas."
                      rows={3}
                      value={guidance}
                    />
                  </div>
                ) : (
                  <Button
                    className="h-auto w-fit px-0 py-0.5 text-muted-foreground hover:bg-transparent hover:text-foreground"
                    onClick={() => setGuidanceOpen(true)}
                    size="xs"
                    type="button"
                    variant="ghost"
                  >
                    <PlusIcon aria-hidden="true" /> Adicionar orientação para a IA
                  </Button>
                )}
              </div>
            </AutoHeight>
          )}
        </div>
        <DialogFooter className="m-0 flex-col rounded-none border-t px-6 py-4 sm:items-center">
          {!draft && (
            <div className="w-full sm:mr-auto sm:w-auto">
              <AiCreditCost cost={cost} available={balance.data?.available} />
            </div>
          )}
          {draft && (
            <Button
              className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
              onClick={() => setDiscardOpen(true)}
              variant="ghost"
            >
              <Trash2Icon /> Descartar propostas
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
            {draft ? "Fechar" : "Cancelar"}
          </Button>
          {draft ? (
            <Button
              disabled={!selectedCount || invalid || approve.isPending}
              onClick={() => void save()}
            >
              Salvar {studyItemCount(kind, selectedCount)}
            </Button>
          ) : queryError ? (
            <Button onClick={() => setOperationId("")} variant="outline">
              Tentar novamente
            </Button>
          ) : (
            !busy && (
              <CreditUpgradeGuard available={balance.data?.available} cost={cost}>
                <Button
                  disabled={
                    !sourcesReady ||
                    !collectionId ||
                    create.isPending ||
                    (balance.data?.available ?? 0) < cost
                  }
                  onClick={() => void requestGeneration()}
                >
                  <MagicWandIcon /> Gerar propostas
                </Button>
              </CreditUpgradeGuard>
            )
          )}
        </DialogFooter>
      </DialogContent>
      <ConfirmationDialog
        actionLabel="Descartar"
        description="As propostas serão removidas. Os créditos já consumidos pela geração não serão devolvidos."
        destructive
        disabled={discard.isPending}
        onConfirm={async () => void (await discardDraft())}
        onOpenChange={setDiscardOpen}
        open={discardOpen}
        title="Descartar propostas geradas?"
      />
    </Dialog>
  );
};

export const AiCollectionGenerationAction = ({
  className,
  collectionId,
  defaultProjectId,
  disabled = false,
  iconOnly = false,
  kind,
}: {
  className?: string;
  collectionId: string;
  defaultProjectId?: string | null;
  disabled?: boolean;
  iconOnly?: boolean;
  kind: AiMaterialKind;
}) => {
  const [open, setOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const requestedOperationId = params.get("aiGeneration");
  const latest = useLatestAiCollectionGeneration(collectionId, !disabled);
  const busy = latest.data?.status === "queued" || latest.data?.status === "processing";
  const ready = latest.data?.status === "completed";
  const material = kind === "flashcard" ? "flashcards" : "questões";
  const label = busy ? "Gerando…" : ready ? "Revisar propostas" : "Gerar com IA";
  useEffect(() => {
    if (requestedOperationId) setOpen(true);
  }, [requestedOperationId]);
  const changeOpen = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen && requestedOperationId)
      setParams(
        (current) => {
          const updated = new URLSearchParams(current);
          updated.delete("aiGeneration");
          return updated;
        },
        { replace: true },
      );
  };
  const trigger = (
    <Button
      aria-label={
        ready
          ? `Revisar ${material} ${kind === "flashcard" ? "gerados" : "geradas"} por IA`
          : `Gerar ${material} com IA`
      }
      className={cn("relative", className)}
      // Other surfaces (an empty collection's guide) open the same dialog through this button.
      data-ai-generation-trigger
      disabled={disabled}
      onClick={() => setOpen(true)}
      size={iconOnly ? "icon" : "sm"}
      variant="outline"
    >
      {busy ? <CircleNotchIcon className="animate-spin" /> : <MagicWandIcon />}
      {!iconOnly && <MorphText text={label} />}
      {/* Proposals waiting for review must be visible even when the action is only an icon. */}
      {ready && iconOnly && (
        <span
          aria-hidden="true"
          className="absolute top-1 right-1 size-2 rounded-full bg-primary ring-2 ring-card"
        />
      )}
    </Button>
  );

  return (
    <>
      {iconOnly ? (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        trigger
      )}
      <AiCollectionGenerationDialog
        collectionId={collectionId}
        defaultProjectId={defaultProjectId}
        kind={kind}
        onOpenChange={changeOpen}
        open={open}
      />
    </>
  );
};

const pendingKey = (projectId: string) => `lazuli:ai-materials:${projectId}`;
const readPending = (projectId: string) => {
  try {
    return localStorage.getItem(pendingKey(projectId));
  } catch {
    return null;
  }
};
const writePending = (projectId: string, operationId: string | null) => {
  try {
    if (operationId) localStorage.setItem(pendingKey(projectId), operationId);
    else localStorage.removeItem(pendingKey(projectId));
  } catch {
    // Storage blocked: the indicator only lasts while the page is open.
  }
};

/**
 * "Criar materiais" from a document or a project. Like the collections' AI action, it keeps
 * showing a generation started here after the dialog closes: generating, then proposals waiting
 * for review, which reopening goes back to.
 */
export const CreateMaterialsButton = ({
  className,
  compactLabel,
  defaultDocumentIds,
  label,
  onApproved,
  onBeforeOpen,
  projectId,
}: {
  className?: string;
  /** A shorter label where the bar is narrow. */
  compactLabel?: string;
  defaultDocumentIds?: string[];
  label: string;
  onApproved?: () => void;
  /** Runs first; returning false keeps the dialog closed (e.g. unsaved edits). */
  onBeforeOpen?: () => boolean | Promise<boolean>;
  projectId: string;
}) => {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(() => readPending(projectId));
  const generation = useAiCollectionGeneration(pending ?? "");
  const data = generation.data;
  const busy = data?.status === "queued" || data?.status === "processing";
  const approved = data?.status === "completed" && data.draft.approved;
  const ready = data?.status === "completed" && !data.draft.approved;
  // A generation that failed, was saved elsewhere or no longer exists stops being shown.
  useEffect(() => {
    if (!pending) return;
    if (generation.isError || approved) {
      writePending(projectId, null);
      setPending(null);
    }
  }, [approved, generation.isError, pending, projectId]);
  const remember = (operationId: string | null) => {
    writePending(projectId, operationId);
    setPending(operationId);
  };
  // The label stays; a generation still here shows as a dot on the corner (spinning while it is
  // generated), as on the collections' AI action.
  return (
    <>
      <Button
        aria-label={
          busy
            ? `${label}: gerando propostas`
            : ready
              ? `${label}: propostas esperando revisão`
              : undefined
        }
        className={cn("relative", className)}
        onClick={async () => {
          if (onBeforeOpen && !(await onBeforeOpen())) return;
          setOpen(true);
        }}
        size="sm"
        variant="outline"
      >
        {busy ? <CircleNotchIcon className="animate-spin" /> : <MagicWandIcon aria-hidden="true" />}
        {compactLabel ? (
          <>
            <span className="sm:hidden">{compactLabel}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : (
          label
        )}
        {ready && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 size-2.5 rounded-full bg-primary ring-2 ring-background"
          />
        )}
      </Button>
      <AiCollectionGenerationDialog
        defaultDocumentIds={defaultDocumentIds}
        defaultProjectId={projectId}
        onApproved={onApproved}
        onOpenChange={setOpen}
        onOperationChange={remember}
        open={open}
        resumeOperationId={ready || busy ? pending : null}
      />
    </>
  );
};

/** A source list stays within its field's column; long titles wrap instead of spilling over. */
const fieldListClass = "min-w-0 [&_[data-slot=select-item]_span]:whitespace-normal";

/**
 * While the material is cut into proposals: the gem catches light and the proposals take shape as
 * outlines, so the wait shows what is coming instead of a spinner.
 */
export const GenerationPending = () => (
  <div
    className="grid min-h-72 content-center justify-items-center gap-8 text-center"
    role="status"
  >
    <div>
      <GemLoader className="mx-auto mb-4" size={32} />
      <p className="font-medium">Gerando propostas…</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Você pode fechar esta janela e voltar depois.
      </p>
    </div>
    <div aria-hidden="true" className="grid w-full max-w-md gap-2">
      {[0.92, 0.74, 0.84].map((width, index) => (
        <div
          className="generation-ghost rounded-[var(--radius)] border border-border bg-card px-4 py-3"
          key={index}
          style={{ animationDelay: `${index * 180}ms` }}
        >
          <span
            className="block h-2.5 rounded-full bg-muted"
            style={{ width: `${width * 100}%` }}
          />
          <span className="mt-2 block h-2.5 w-1/2 rounded-full bg-muted" />
        </div>
      ))}
    </div>
  </div>
);
