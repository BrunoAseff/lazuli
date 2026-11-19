import {
  STUDY_COLLECTION_MAX_PAGE_SIZE,
  type DocumentSummary,
  type FlashcardCollectionSummary,
  type QuizCollectionSummary,
} from "@lazuli/shared";
import { useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { Link, useNavigate } from "react-router";

import {
  DocumentDomainIcon,
  FlashcardDomainIcon,
  QuizDomainIcon,
} from "@/components/domain-icons.ts";
import { FlashcardCollectionMark } from "@/components/flashcard-collection-mark.tsx";
import { PlusIcon } from "@/components/icons.tsx";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { QuizCollectionMark } from "@/components/quiz-collection-mark.tsx";
import { StudyStrip } from "@/components/study-collection-card.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { formatRecent, formatUpdated } from "@/lib/date-format.ts";
import { useFlashcardCollections } from "@/features/flashcards/api/flashcard-collection-queries.ts";
import {
  practicePaths,
  usePracticeAvailability,
} from "@/features/flashcards/api/flashcard-queries.ts";
import { FlashcardCollectionDialog } from "@/features/flashcards/components/flashcard-collection-dialogs.tsx";
import {
  memoryLabel,
  memorySegments,
} from "@/features/flashcards/components/flashcard-collection-list.tsx";
import { PracticeSetupDialog } from "@/features/flashcards/components/practice-setup-dialog.tsx";
import { useQuizCollections } from "@/features/quizzes/api/quiz-collection-queries.ts";
import { QuizCollectionDialog } from "@/features/quizzes/components/quiz-collection-dialogs.tsx";
import { QuizCollectionStrip } from "@/features/quizzes/components/quiz-collection-list.tsx";
import { QuizStartDialog } from "@/features/quizzes/components/quiz-start-dialog.tsx";
import { useProjectDocumentMaterials } from "@/features/references/api/reference-queries.ts";

/*
 * The project's home: what to study now, the project's collections and its documents, each saying
 * what came out of it. Side by side when the content area holds both (48rem), stacked otherwise.
 */

const SIDE_BY_SIDE = 48 * 16;

const count = (value: number, singular: string, plural: string) =>
  `${value} ${value === 1 ? singular : plural}`;

type Collection =
  | { kind: "flashcard"; item: FlashcardCollectionSummary }
  | { kind: "quiz"; item: QuizCollectionSummary };

const useProjectCollections = (projectId: string) => {
  const input = {
    favorites: "all" as const,
    page: 1,
    pageSize: STUDY_COLLECTION_MAX_PAGE_SIZE,
    project: projectId,
    query: "",
    status: "active" as const,
  };
  const flashcards = useFlashcardCollections(input);
  const quizzes = useQuizCollections(input);
  const items: Collection[] = [
    ...(flashcards.data?.items ?? []).map((item) => ({ kind: "flashcard" as const, item })),
    ...(quizzes.data?.items ?? []).map((item) => ({ kind: "quiz" as const, item })),
  ];
  return {
    items,
    flashcardCount: flashcards.data?.pagination.totalItems ?? 0,
    pending: flashcards.isPending || quizzes.isPending,
    total:
      (flashcards.data?.pagination.totalItems ?? 0) + (quizzes.data?.pagination.totalItems ?? 0),
  };
};

/** Width of the element, so the layout follows the content area, not the window. */
const useWidth = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
};

export const projectStudyMeta = (documentCount: number, collectionCount: number) =>
  `${count(documentCount, "documento", "documentos")} · ${count(collectionCount, "coleção", "coleções")}`;

export const useProjectCollectionCount = (projectId: string) =>
  useProjectCollections(projectId).total;

/* What to study now -------------------------------------------------------------------------- */

const StudySummary = ({
  projectId,
  hasFlashcardCollections,
  stacked,
}: {
  projectId: string;
  hasFlashcardCollections: boolean;
  stacked: boolean;
}) => {
  const navigate = useNavigate();
  const [setupOpen, setSetupOpen] = useState(false);
  const target = { type: "project" as const, id: projectId };
  const availability = usePracticeAvailability(target, hasFlashcardCollections);
  const data = availability.data;
  const active = data?.activeSession;
  const reviews = data?.dueCards ?? 0;
  const fresh = data?.newCards ?? 0;
  const summary = !hasFlashcardCollections
    ? "Nenhuma coleção de flashcards neste projeto"
    : availability.isPending
      ? null
      : active
        ? `Revisão em andamento: ${active.reviewedCards} de ${count(active.totalCards, "flashcard", "flashcards")}`
        : reviews && fresh
          ? `${count(reviews, "flashcard", "flashcards")} para revisar e ${count(fresh, "novo", "novos")}`
          : reviews
            ? `${count(reviews, "flashcard", "flashcards")} para revisar`
            : fresh
              ? count(fresh, "flashcard novo", "flashcards novos")
              : "Tudo revisado";
  const action = active ? (
    <Button
      className={stacked ? undefined : "mt-3 w-full"}
      onClick={() => void navigate(practicePaths(target).session(active.id))}
      size="sm"
    >
      Continuar revisão
    </Button>
  ) : data?.totalAvailable ? (
    <Button
      className={stacked ? undefined : "mt-3 w-full"}
      onClick={() => setSetupOpen(true)}
      size="sm"
    >
      Revisar flashcards
    </Button>
  ) : null;
  const text = (
    <div className="min-w-0">
      <h2 className="text-sm leading-snug font-semibold">Estudo deste projeto</h2>
      {summary ? (
        <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{summary}</p>
      ) : (
        <Skeleton className="mt-1.5 h-3.5 w-48" />
      )}
    </div>
  );
  return (
    <>
      {stacked ? (
        <div className="flex items-center justify-between gap-6">
          {text}
          {action}
        </div>
      ) : (
        <div>
          {text}
          {action}
        </div>
      )}
      {setupOpen && (
        <PracticeSetupDialog
          onOpenChange={(open) => !open && setSetupOpen(false)}
          open
          projectId={projectId}
        />
      )}
    </>
  );
};

/* Collections -------------------------------------------------------------------------------- */

const collectionHref = ({ kind, item }: Collection) =>
  kind === "flashcard" ? `/flashcards/${item.id}` : `/quizzes/${item.id}`;

const CollectionTitle = ({
  collection,
  className,
}: {
  collection: Collection;
  className: string;
}) => (
  <OverflowTooltip text={collection.item.title}>
    {(ref) => (
      <Link
        className={`block truncate underline-offset-4 hover:underline ${className}`}
        ref={ref as Ref<HTMLAnchorElement>}
        to={collectionHref(collection)}
      >
        {collection.item.title}
      </Link>
    )}
  </OverflowTooltip>
);

const CollectionStrip = ({ collection }: { collection: Collection }) =>
  collection.kind === "flashcard" ? (
    <StudyStrip
      emptyLabel="Nenhum flashcard ainda"
      label={memoryLabel(collection.item)}
      noun={{ singular: "flashcard", plural: "flashcards" }}
      segments={memorySegments(collection.item)}
    />
  ) : (
    <QuizCollectionStrip collection={collection.item} />
  );

/** The collection's own action: review what is due, answer the quiz, or open it. */
const CollectionAction = ({
  collection,
  onPractice,
  onStartQuiz,
  size,
}: {
  collection: Collection;
  onPractice: (id: string) => void;
  onStartQuiz: (id: string) => void;
  size: "sm" | "xs";
}) => {
  if (collection.kind === "flashcard" && collection.item.dueCards > 0)
    return (
      <Button onClick={() => onPractice(collection.item.id)} size={size} variant="outline">
        Revisar
      </Button>
    );
  if (collection.kind === "quiz" && collection.item.totalQuestions > 0)
    return (
      <Button onClick={() => onStartQuiz(collection.item.id)} size={size} variant="outline">
        Responder
      </Button>
    );
  return (
    <Button asChild size={size} variant="outline">
      <Link to={collectionHref(collection)}>Abrir</Link>
    </Button>
  );
};

const collectionMeta = (collection: Collection) =>
  collection.kind === "flashcard"
    ? `Flashcards · ${count(collection.item.totalCards, "flashcard", "flashcards")}`
    : `Quiz · ${count(collection.item.totalQuestions, "questão", "questões")}`;

const NewCollection = ({ projectId }: { projectId: string }) => {
  const [creating, setCreating] = useState<"flashcard" | "quiz" | null>(null);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            className="h-auto w-fit px-0 py-0.5 text-muted-foreground hover:bg-transparent hover:text-foreground aria-expanded:bg-transparent"
            size="xs"
            variant="ghost"
          >
            <PlusIcon aria-hidden="true" /> Nova coleção
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => setCreating("flashcard")}>
            <FlashcardDomainIcon /> Flashcards
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setCreating("quiz")}>
            <QuizDomainIcon /> Quiz
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FlashcardCollectionDialog
        defaultProjectId={projectId}
        onOpenChange={(open) => !open && setCreating(null)}
        open={creating === "flashcard"}
      />
      <QuizCollectionDialog
        defaultProjectId={projectId}
        onOpenChange={(open) => !open && setCreating(null)}
        open={creating === "quiz"}
      />
    </>
  );
};

const CollectionsBody = ({
  collections,
  projectId,
  stacked,
}: {
  collections: ReturnType<typeof useProjectCollections>;
  projectId: string;
  stacked: boolean;
}) => {
  const [practicing, setPracticing] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  return (
    <div className="grid gap-5 border-t pt-5">
      {collections.pending ? (
        <Skeleton className="h-12 w-full" />
      ) : collections.items.length === 0 ? (
        <p className="text-[0.8125rem] text-muted-foreground">
          Este projeto ainda não tem coleções.
        </p>
      ) : (
        collections.items.map((collection) =>
          stacked ? (
            <div
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5"
              key={collection.item.id}
            >
              {collection.kind === "flashcard" ? (
                <FlashcardCollectionMark />
              ) : (
                <QuizCollectionMark />
              )}
              <div className="min-w-0">
                <CollectionTitle
                  className="text-[0.9375rem] leading-snug font-medium"
                  collection={collection}
                />
                <p className="mt-0.5 text-xs text-muted-foreground">{collectionMeta(collection)}</p>
              </div>
              <CollectionAction
                collection={collection}
                onPractice={setPracticing}
                onStartQuiz={setStarting}
                size="sm"
              />
              <div className="col-start-2 col-end-4">
                <CollectionStrip collection={collection} />
              </div>
            </div>
          ) : (
            <div className="grid gap-2" key={collection.item.id}>
              <div className="flex min-w-0 items-center gap-2.5">
                {collection.kind === "flashcard" ? (
                  <FlashcardDomainIcon className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <QuizDomainIcon className="size-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <CollectionTitle className="text-sm font-medium" collection={collection} />
                </div>
                <CollectionAction
                  collection={collection}
                  onPractice={setPracticing}
                  onStartQuiz={setStarting}
                  size="xs"
                />
              </div>
              <CollectionStrip collection={collection} />
            </div>
          ),
        )
      )}
      <NewCollection projectId={projectId} />
      {practicing && (
        <PracticeSetupDialog
          collectionId={practicing}
          onOpenChange={(open) => !open && setPracticing(null)}
          open
        />
      )}
      {starting && (
        <QuizStartDialog
          collectionId={starting}
          onOpenChange={(open) => !open && setStarting(null)}
          open
        />
      )}
    </div>
  );
};

/* Documents ---------------------------------------------------------------------------------- */

const useMaterialsByDocument = (projectId: string) => {
  const materials = useProjectDocumentMaterials(projectId);
  return (documentId: string) => {
    if (!materials.data) return "";
    const found = materials.data.items.find((item) => item.documentId === documentId);
    if (!found || found.flashcards + found.questions === 0) return "Nenhum material";
    return [
      found.flashcards && count(found.flashcards, "flashcard", "flashcards"),
      found.questions && count(found.questions, "questão", "questões"),
    ]
      .filter(Boolean)
      .join(" · ");
  };
};

const DocumentTitle = ({
  document,
  projectId,
  className,
}: {
  document: DocumentSummary;
  projectId: string;
  className: string;
}) => (
  <OverflowTooltip text={document.title}>
    {(ref) => (
      <Link
        className={`block truncate underline-offset-4 hover:underline ${className}`}
        ref={ref as Ref<HTMLAnchorElement>}
        to={`/documents/${projectId}/document/${document.id}`}
      >
        {document.title}
      </Link>
    )}
  </OverflowTooltip>
);

/** Stacked: the documents as a table, with what came out of each. */
const DocumentsTable = ({
  documents,
  projectId,
}: {
  documents: DocumentSummary[];
  projectId: string;
}) => {
  const materialsOf = useMaterialsByDocument(projectId);
  const columns = "grid grid-cols-[minmax(0,1fr)_9.5rem_6.5rem] gap-4";
  return (
    <section aria-label="Documentos recentes" className="surface-panel mt-4 overflow-hidden">
      <div className={`${columns} border-b px-6 py-3 text-xs text-muted-foreground`}>
        <span>Documentos recentes</span>
        <span>Materiais</span>
        <span className="text-right">Atualizado</span>
      </div>
      {documents.map((document) => (
        <div
          className={`${columns} items-center border-b px-6 py-3 last:border-b-0`}
          key={document.id}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <DocumentDomainIcon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <DocumentTitle className="text-sm" document={document} projectId={projectId} />
            </span>
          </span>
          <span className="truncate text-[0.8125rem] text-muted-foreground">
            {materialsOf(document.id)}
          </span>
          <time
            className="text-right text-[0.8125rem] text-muted-foreground"
            dateTime={document.updatedAt}
          >
            {formatRecent(document.updatedAt)}
          </time>
        </div>
      ))}
    </section>
  );
};

/** Side by side: the documents as a list, each saying what came out of it. */
const DocumentsList = ({
  documents,
  projectId,
}: {
  documents: DocumentSummary[];
  projectId: string;
}) => {
  const materialsOf = useMaterialsByDocument(projectId);
  return (
    <section aria-labelledby="project-documents-title" className="surface-panel p-6">
      <h2 className="text-sm leading-snug font-semibold" id="project-documents-title">
        Documentos recentes
      </h2>
      <div className="mt-4 grid gap-4">
        {documents.map((document) => (
          <div className="flex min-w-0 items-start gap-3" key={document.id}>
            <DocumentDomainIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <DocumentTitle
                className="text-[0.9375rem] leading-snug font-medium"
                document={document}
                projectId={projectId}
              />
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {[materialsOf(document.id), formatUpdated(document.updatedAt).toLowerCase()]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

/* Page body ---------------------------------------------------------------------------------- */

export const ProjectStudy = ({
  documents,
  emptyDocuments,
  projectId,
}: {
  documents: DocumentSummary[];
  /** Shown in place of the documents when the project has none. */
  emptyDocuments: ReactNode;
  projectId: string;
}) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const collections = useProjectCollections(projectId);
  const sideBySide = width >= SIDE_BY_SIDE;
  const study = (stacked: boolean) => (
    <section
      aria-label="Estudo deste projeto"
      className={`surface-panel grid p-6 ${stacked ? "gap-6" : "gap-5"}`}
    >
      <StudySummary
        hasFlashcardCollections={collections.flashcardCount > 0}
        projectId={projectId}
        stacked={stacked}
      />
      <CollectionsBody collections={collections} projectId={projectId} stacked={stacked} />
    </section>
  );
  return (
    <div ref={ref}>
      {width === 0 ? null : sideBySide ? (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,20rem)] items-start gap-4">
          {documents.length ? (
            <DocumentsList documents={documents} projectId={projectId} />
          ) : (
            emptyDocuments
          )}
          {study(false)}
        </div>
      ) : (
        <>
          {study(true)}
          {documents.length ? (
            <DocumentsTable documents={documents} projectId={projectId} />
          ) : (
            <div className="mt-4">{emptyDocuments}</div>
          )}
        </>
      )}
    </div>
  );
};
