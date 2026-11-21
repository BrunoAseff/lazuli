import {
  STUDY_COLLECTION_MAX_PAGE_SIZE,
  type DocumentSummary,
  type FlashcardCollectionSummary,
  type QuizCollectionSummary,
} from "@lazuli/shared";
import { useState, type ReactNode, type Ref } from "react";
import { Link, useNavigate } from "react-router";

import {
  DocumentDomainIcon,
  FlashcardDomainIcon,
  QuizDomainIcon,
} from "@/components/domain-icons.ts";
import { FlashcardCollectionMark } from "@/components/flashcard-collection-mark.tsx";
import { PlayIcon, PlusIcon } from "@/components/icons.tsx";
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
import { formatRecent } from "@/lib/date-format.ts";
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
import { FlashcardPracticeButton } from "@/features/flashcards/components/flashcard-practice-button.tsx";
import { PracticeSetupDialog } from "@/features/flashcards/components/practice-setup-dialog.tsx";
import { useQuizCollections } from "@/features/quizzes/api/quiz-collection-queries.ts";
import { QuizCollectionDialog } from "@/features/quizzes/components/quiz-collection-dialogs.tsx";
import { QuizCollectionStrip } from "@/features/quizzes/components/quiz-collection-list.tsx";
import { QuizStartDialog } from "@/features/quizzes/components/quiz-start-dialog.tsx";
import { useProjectDocumentMaterials } from "@/features/references/api/reference-queries.ts";
import { Progress } from "@/components/ui/progress.tsx";
import { useStone } from "@/features/stone/api/stone-queries.ts";
import { goldBar } from "@/features/stone/components/stone-parts.tsx";

/*
 * The project's home: what to study now and the project's collections on top, then its documents,
 * each saying what came out of it.
 */

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

export const projectStudyMeta = (documentCount: number, collectionCount: number) =>
  `${count(documentCount, "documento", "documentos")} · ${count(collectionCount, "coleção", "coleções")}`;

export const useProjectCollectionCount = (projectId: string) =>
  useProjectCollections(projectId).total;

/* What to study now -------------------------------------------------------------------------- */

const StudySummary = ({
  collections,
  projectId,
}: {
  collections: ReturnType<typeof useProjectCollections>;
  projectId: string;
}) => {
  const navigate = useNavigate();
  const [setupOpen, setSetupOpen] = useState(false);
  const target = { type: "project" as const, id: projectId };
  const hasFlashcards = collections.flashcardCount > 0;
  const availability = usePracticeAvailability(target, hasFlashcards);
  const data = availability.data;
  const active = data?.activeSession;
  const reviews = data?.dueCards ?? 0;
  const fresh = data?.newCards ?? 0;
  const empty = !collections.pending && collections.total === 0;
  const summary = collections.pending
    ? null
    : empty
      ? "Ainda não há flashcards nem questões neste projeto."
      : !hasFlashcards
        ? "Nenhum flashcard neste projeto ainda."
        : availability.isPending
          ? null
          : active
            ? `Prática em andamento: ${active.reviewedCards} de ${count(active.totalCards, "flashcard", "flashcards")}`
            : reviews && fresh
              ? `${count(reviews, "flashcard", "flashcards")} para revisar e ${count(fresh, "novo", "novos")}`
              : reviews
                ? `${count(reviews, "flashcard", "flashcards")} para revisar`
                : fresh
                  ? count(fresh, "flashcard novo", "flashcards novos")
                  : "Todos os flashcards em dia.";
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h2 className="text-sm leading-snug font-semibold">Estudo deste projeto</h2>
          {summary ? (
            <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">{summary}</p>
          ) : (
            <Skeleton className="mt-1.5 h-3.5 w-48" />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <NewCollection projectId={projectId} />
          {active ? (
            <Button
              onClick={() => void navigate(practicePaths(target).session(active.id))}
              size="sm"
            >
              <PlayIcon aria-hidden="true" /> Continuar prática
            </Button>
          ) : data?.totalAvailable ? (
            <Button onClick={() => setSetupOpen(true)} size="sm">
              <PlayIcon aria-hidden="true" /> Praticar flashcards
            </Button>
          ) : null}
        </div>
      </div>
      <ProjectMastery projectId={projectId} />
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

/** How much of the project is mastered, in gold: the stone's view of this project. */
const ProjectMastery = ({ projectId }: { projectId: string }) => {
  const stone = useStone();
  const project = stone.data?.projects.find((item) => item.projectId === projectId);
  if (!project?.total) return null;
  return (
    <div className="-mt-2 grid gap-1.5">
      <div className="flex justify-between gap-3 text-xs">
        <span>
          {project.mastered} de {project.total} itens dominados
        </span>
        <span className="text-muted-foreground tabular-nums">
          {Math.round((project.mastered / project.total) * 100)}%
        </span>
      </div>
      <Progress
        aria-label="Itens dominados do projeto"
        className={goldBar}
        max={project.total}
        value={project.mastered}
      />
    </div>
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

/** The collection's own action, named as in the collection lists: Praticar or Iniciar. */
const CollectionAction = ({
  collection,
  onPractice,
  onStartQuiz,
}: {
  collection: Collection;
  onPractice: (id: string) => void;
  onStartQuiz: (id: string) => void;
}) =>
  collection.kind === "flashcard" ? (
    <FlashcardPracticeButton
      dueCards={collection.item.dueCards}
      fullWidthOnMobile={false}
      onClick={() => onPractice(collection.item.id)}
      title={collection.item.title}
      totalCards={collection.item.totalCards}
      variant="outline"
    />
  ) : (
    <Button
      disabled={collection.item.totalQuestions === 0}
      onClick={() => onStartQuiz(collection.item.id)}
      size="sm"
      variant="outline"
    >
      <PlayIcon aria-hidden="true" /> Iniciar
    </Button>
  );

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
          <Button size="sm" variant="outline">
            <PlusIcon aria-hidden="true" /> Nova coleção
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
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
}: {
  collections: ReturnType<typeof useProjectCollections>;
}) => {
  const [practicing, setPracticing] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  return (
    <div className="grid gap-5 border-t pt-5">
      {collections.pending ? (
        <Skeleton className="h-12 w-full" />
      ) : (
        collections.items.map((collection) => (
          <div
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5"
            key={collection.item.id}
          >
            {collection.kind === "flashcard" ? <FlashcardCollectionMark /> : <QuizCollectionMark />}
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
            />
            <div className="col-start-2 col-end-4">
              <CollectionStrip collection={collection} />
            </div>
          </div>
        ))
      )}
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
  const columns = "grid grid-cols-[minmax(0,1fr)_12rem_6rem] gap-4";
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
  const collections = useProjectCollections(projectId);
  return (
    <>
      <section aria-label="Estudo deste projeto" className="surface-panel grid gap-6 p-5 sm:p-6">
        <StudySummary collections={collections} projectId={projectId} />
        {(collections.pending || collections.total > 0) && (
          <CollectionsBody collections={collections} />
        )}
      </section>
      {documents.length ? (
        <DocumentsTable documents={documents} projectId={projectId} />
      ) : (
        <div className="mt-4">{emptyDocuments}</div>
      )}
    </>
  );
};
