import { isNotFound, ResourceUnavailable } from "@/components/not-found-page.tsx";
import {
  QUIZ_QUESTION_PAGE_SIZE,
  quizQuestionListQuerySchema,
  type StudyCollectionStatus,
  type QuizQuestionDetail,
  type QuizQuestionSummary,
} from "@lazuli/shared";
import {
  ArchiveIcon,
  ArrowLeftIcon,
  CalendarPlusIcon,
  FilterIcon,
  HistoryIcon,
  ListOrderedIcon,
  PlayIcon,
  PlusIcon,
  SquareCheckBig,
} from "@/components/icons.tsx";
import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { ConfirmationDialog } from "@/components/confirmation-dialog.tsx";
import { FilterSelect } from "@/components/filter-select.tsx";
import { FilterCount } from "@/components/filter-count.tsx";
import { PaginationControls } from "@/components/pagination-controls.tsx";
import { SearchInput } from "@/components/search-input.tsx";
import { StudyItemSummaryBar } from "@/components/study-item-summary-bar.tsx";
import { StudyWorkspaceSkeleton } from "@/components/study-workspace-skeleton.tsx";
import { StudyItemListState } from "@/components/study-item-list-state.tsx";
import { HighlightText } from "@/components/highlight-text.tsx";
import {
  StudyIndexHeader,
  StudyIndexList,
  StudyIndexRow,
  StudyIndexScroll,
  StudyIndexSkeleton,
  StudyIndexTools,
} from "@/components/study-index.tsx";
import { resultCount } from "@/lib/text.ts";
import { AiCollectionGenerationAction } from "@/features/ai/components/ai-collection-generation-dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { StudyCollectionStart } from "@/components/study-collection-start.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useIsMobile } from "@/hooks/use-mobile.ts";
import { useDebouncedSearch } from "@/hooks/use-debounced-search.ts";
import { cn } from "@/lib/utils.ts";
import { parsePositivePage } from "@/lib/pagination.ts";
import { mergeSearchParams } from "@/lib/search-params.ts";
import type { StudyItemBatchAction } from "@/lib/study-actions.ts";
import {
  findReplacementStudyItemId,
  type PendingStudyEditorState,
  type StudyEditorState,
} from "@/lib/study-editor.ts";
import { useQuizCollection } from "../api/quiz-collection-queries.ts";
import {
  useDeleteQuizQuestion,
  usePatchQuizQuestion,
  useQuizAttemptAvailability,
  useQuizQuestion,
  useQuizQuestions,
} from "../api/quiz-queries.ts";
import { QuizQuestionPanel } from "../components/quiz-question-dialog.tsx";
import { QuizStartDialog } from "../components/quiz-start-dialog.tsx";

// A quiz is read in its own order, so its index follows it by default (numbers ascend).
const quizQuestionListDefaults = { sort: "position", status: "active" };

export const QuizCollectionPage = () => {
  const { collectionId = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = params.get("query")?.slice(0, 200).trim() ?? "";
  const linkedQuestionId = params.get("question");
  const input = quizQuestionListQuerySchema.parse({
    query,
    status: params.get("status") === "archived" ? "archived" : "active",
    sort: ["created", "updated"].includes(params.get("sort") ?? "")
      ? params.get("sort")
      : "position",
    page: parsePositivePage(params.get("page")),
    pageSize: QUIZ_QUESTION_PAGE_SIZE,
  });
  const updateParams = (
    changes: Record<string, string | undefined>,
    resetPage = true,
    replace = false,
  ) =>
    setParams(
      (current) =>
        mergeSearchParams(current, changes, {
          defaults: quizQuestionListDefaults,
          resetPage,
        }),
      { replace },
    );
  const [search, setSearch] = useDebouncedSearch(query, (value) =>
    updateParams({ query: value || undefined }),
  );
  const [selected, setSelected] = useState(new Set<string>());
  const [editor, setEditor] = useState<StudyEditorState>(null);
  const [duplicateSource, setDuplicateSource] = useState<QuizQuestionDetail | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [pendingEditor, setPendingEditor] = useState<PendingStudyEditorState>(null);
  const [pendingDelete, setPendingDelete] = useState<QuizQuestionSummary | null>(null);
  const [pendingArchive, setPendingArchive] = useState<QuizQuestionSummary | null>(null);
  const [batchAction, setBatchAction] = useState<StudyItemBatchAction | null>(null);
  const [startOpen, setStartOpen] = useState(() => params.get("start") === "true");
  const compact = useIsMobile();
  const collection = useQuizCollection(collectionId);
  const questions = useQuizQuestions(collectionId, input);
  const availability = useQuizAttemptAvailability(collectionId);
  const detail = useQuizQuestion(collectionId, editor?.type === "edit" ? editor.id : null);
  const remove = useDeleteQuizQuestion(collectionId);
  const patchQuestion = usePatchQuizQuestion(collectionId);

  useEffect(() => {
    if (linkedQuestionId)
      setEditor(
        linkedQuestionId === "new" ? { type: "create" } : { type: "edit", id: linkedQuestionId },
      );
  }, [linkedQuestionId]);
  useEffect(() => setSelected(new Set()), [input.page, input.query, input.status]);
  useEffect(() => {
    const totalPages = questions.data?.pagination.totalPages;
    if (totalPages !== undefined && input.page > Math.max(totalPages, 1))
      updateParams({ page: totalPages > 1 ? String(totalPages) : undefined }, false, true);
  }, [questions.data?.pagination.totalPages, input.page]);
  useEffect(() => {
    if (compact || editor || linkedQuestionId || !questions.data?.items.length) return;
    const first = questions.data.items[0];
    if (!first) return;
    setEditor({ type: "edit", id: first.id });
    updateParams({ question: first.id }, false, true);
  }, [compact, editor, linkedQuestionId, questions.data?.items]);

  const activeId = editor?.type === "edit" ? editor.id : undefined;
  const changeEditor = (next: Exclude<StudyEditorState, null>) => {
    if (editorDirty) return setPendingEditor(next);
    setDuplicateSource(null);
    setEditor(next);
    updateParams({ question: next.type === "create" ? "new" : next.id }, false);
  };
  const openDuplicateDraft = (question: QuizQuestionDetail) => {
    setDuplicateSource(question);
    setEditor({ type: "create" });
    updateParams({ question: "new" }, false);
  };
  const replacementQuestionId = (excluded: Set<string>) => {
    const visible = questions.data?.items ?? [];
    return findReplacementStudyItemId(visible, activeId, excluded);
  };
  const showReplacement = (replacementId?: string) => {
    if (replacementId) {
      setEditor({ type: "edit", id: replacementId });
      updateParams({ question: replacementId }, false, true);
    } else {
      setEditor(null);
      updateParams({ question: undefined }, false, true);
    }
  };
  const closeEditor = () => {
    if (editorDirty) return setPendingEditor("close");
    setEditor(null);
    updateParams({ question: undefined }, false, true);
  };
  const changeStatus = async (question: QuizQuestionSummary, archived: boolean) => {
    try {
      await patchQuestion.mutateAsync({
        questionId: question.id,
        input: { archived },
      });
      if (activeId === question.id) closeEditor();
      toast.success(archived ? "Questão arquivada." : "Questão restaurada.");
    } catch {
      toast.error("Não foi possível atualizar a questão.");
    }
  };
  const performBatch = async (action: StudyItemBatchAction) => {
    const selectedIds = new Set(selected);
    const replacesActive = Boolean(activeId && selectedIds.has(activeId));
    const replacementId = replacesActive ? replacementQuestionId(selectedIds) : undefined;
    try {
      if (action !== "delete")
        await Promise.all(
          [...selected].map((questionId) =>
            patchQuestion.mutateAsync({
              questionId,
              input: { archived: action === "archive" },
            }),
          ),
        );
      else await Promise.all([...selected].map((questionId) => remove.mutateAsync(questionId)));
      if (replacesActive) showReplacement(replacementId);
      setSelected(new Set());
      setBatchAction(null);
      toast.success(
        action === "archive"
          ? "Questões arquivadas."
          : action === "restore"
            ? "Questões restauradas."
            : "Questões excluídas.",
      );
    } catch {
      toast.error("Não foi possível alterar as questões selecionadas.");
    }
  };

  if (collection.isPending)
    return <StudyWorkspaceSkeleton editorOpen={Boolean(params.get("question"))} />;
  if (collection.isError)
    return (
      <ResourceUnavailable
        backLabel="Voltar aos quizzes"
        backTo="/quizzes"
        notFound={isNotFound(collection.error)}
        onRetry={() => void collection.refetch()}
        title="Coleção não encontrada"
      />
    );
  const summary = collection.data;
  const appliedFilters = Number(input.sort !== "position") + Number(input.status !== "active");
  const narrowed = Boolean(query) || input.status !== "active";

  return (
    <main className="study-workspace">
      <section className="study-workspace-columns">
        <aside className={cn("min-h-0 flex-col bg-background md:flex", editor ? "hidden" : "flex")}>
          <StudyIndexHeader
            actions={
              <>
                <Button
                  disabled={Boolean(summary.archivedAt) || availability.data?.totalQuestions === 0}
                  onClick={() => setStartOpen(true)}
                >
                  <PlayIcon />
                  {availability.data?.activeAttempt ? "Continuar" : "Iniciar"}
                </Button>
                <Button
                  disabled={Boolean(summary.archivedAt)}
                  onClick={() => changeEditor({ type: "create" })}
                  variant="outline"
                >
                  <PlusIcon /> Adicionar
                </Button>
                <AiCollectionGenerationAction
                  collectionId={collectionId}
                  defaultProjectId={summary.project?.id}
                  disabled={Boolean(summary.archivedAt)}
                  iconOnly
                  kind="quizQuestion"
                />
              </>
            }
            backTo="/quizzes"
            meta={`${summary.totalQuestions} ${summary.totalQuestions === 1 ? "questão" : "questões"}`}
            project={summary.project}
            title={summary.title}
          />
          <StudyIndexTools
            selecting={selected.size > 0}
            selection={
              <QuizSummary
                selected={selected.size}
                onClear={() => setSelected(new Set())}
                onDelete={() => setBatchAction("delete")}
                onToggleArchive={() =>
                  input.status === "active"
                    ? setBatchAction("archive")
                    : void performBatch("restore")
                }
                status={input.status}
              />
            }
          >
            <SearchInput
              aria-label="Pesquisar questões"
              containerClassName="flex-1"
              disabled={
                !questions.isPending && !query && questions.data?.pagination.totalItems === 0
              }
              maxLength={200}
              onClear={() => {
                setSearch("");
                updateParams({ query: undefined });
              }}
              onValueChange={setSearch}
              placeholder="Buscar questões"
              value={search}
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  aria-label={
                    appliedFilters
                      ? `Filtrar e ordenar (${appliedFilters} ${appliedFilters === 1 ? "ativo" : "ativos"})`
                      : "Filtrar e ordenar"
                  }
                  className="relative h-9 shrink-0 px-0"
                  variant="outline"
                >
                  <FilterIcon />
                  <span className="absolute -top-1.5 -right-1.5">
                    <FilterCount count={appliedFilters} />
                  </span>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] gap-4 p-4">
                <FilterSelect
                  label="Ordenar"
                  value={input.sort}
                  onChange={(value) => updateParams({ sort: value })}
                  options={[
                    ["position", "Ordem do quiz", ListOrderedIcon],
                    ["updated", "Atualizadas", HistoryIcon],
                    ["created", "Criadas", CalendarPlusIcon],
                  ]}
                />
                <FilterSelect
                  label="Estado"
                  value={input.status}
                  onChange={(value) => updateParams({ status: value })}
                  options={[
                    ["active", "Ativas", SquareCheckBig],
                    ["archived", "Arquivadas", ArchiveIcon],
                  ]}
                />
                {appliedFilters > 0 && (
                  <Button
                    className="w-full"
                    onClick={() => updateParams({ sort: "position", status: "active" })}
                    variant="outline"
                  >
                    Limpar filtros
                  </Button>
                )}
              </PopoverContent>
            </Popover>
          </StudyIndexTools>
          {narrowed && questions.data && (
            /* With no match the empty state says it; the count stays for screen readers only. */
            <p
              aria-live="polite"
              className={cn(
                "study-index-results",
                questions.data.pagination.totalItems === 0 && "sr-only",
              )}
            >
              {resultCount(questions.data.pagination.totalItems, "questão", "questões")}
            </p>
          )}
          <StudyIndexScroll>
            <StudyItemListState
              createLabel="Criar questão"
              emptyIcon={SquareCheckBig}
              guidedElsewhere={input.status === "active"}
              emptyTitle={
                input.status === "archived" ? "Nenhuma questão arquivada" : "Nenhuma questão ainda"
              }
              error={questions.isError}
              loading={questions.isPending}
              onCreate={
                input.status === "active" ? () => changeEditor({ type: "create" }) : undefined
              }
              onRetry={() => void questions.refetch()}
              query={query}
              skeleton={<StudyIndexSkeleton label="Carregando questões" />}
              totalItems={questions.data?.pagination.totalItems}
            >
              <StudyIndexList label="Questões do quiz" selecting={selected.size > 0}>
                {questions.data?.items.map((question) => (
                  <QuestionIndexItem
                    active={activeId === question.id}
                    key={question.id}
                    onOpen={() => changeEditor({ type: "edit", id: question.id })}
                    onSelect={(checked) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        if (checked) next.add(question.id);
                        else next.delete(question.id);
                        return next;
                      })
                    }
                    query={query}
                    question={question}
                    selected={selected.has(question.id)}
                  />
                ))}
              </StudyIndexList>
            </StudyItemListState>
          </StudyIndexScroll>
          {questions.data && questions.data.pagination.totalPages > 1 && (
            <div className="border-t border-[var(--line-subtle)] px-2">
              <PaginationControls
                className="mt-0 h-14"
                label="Paginação de questões"
                onPageChange={(page) =>
                  updateParams({ page: page > 1 ? String(page) : undefined }, false)
                }
                pagination={questions.data.pagination}
              />
            </div>
          )}
        </aside>
        <div
          className={cn(
            "@container/study-workspace min-h-0 min-w-0 flex-col bg-background md:flex",
            editor ? "flex" : "hidden",
          )}
        >
          {editor && (
            <div className="flex h-12 shrink-0 items-center border-b px-3 md:hidden">
              <Button onClick={closeEditor} size="sm" variant="ghost">
                <ArrowLeftIcon /> Questões
              </Button>
            </div>
          )}
          <div className="flex min-h-0 flex-1">
            {editor?.type === "create" && (
              <QuizQuestionPanel
                collectionId={collectionId}
                initialContent={duplicateSource?.content}
                initialOptions={duplicateSource?.options.map(({ isCorrect, text }) => ({
                  id: crypto.randomUUID(),
                  isCorrect,
                  text,
                }))}
                key={duplicateSource ? `duplicate-${duplicateSource.id}` : "new"}
                onDirtyChange={setEditorDirty}
                onOpenChange={() => undefined}
                onSaved={(id, savedCollectionId) => {
                  setEditorDirty(false);
                  setDuplicateSource(null);
                  if (savedCollectionId !== collectionId)
                    void navigate(`/quizzes/${savedCollectionId}?question=${id}`);
                  else {
                    setEditor({ type: "edit", id });
                    updateParams({ question: id }, false, true);
                  }
                }}
                open
                readOnly={Boolean(summary.archivedAt || detail.data?.archivedAt)}
              />
            )}
            {editor?.type === "edit" && detail.data && (
              <QuizQuestionPanel
                collectionId={collectionId}
                key={detail.data.id}
                onAction={(action) => {
                  if (action === "delete") setPendingDelete(detail.data);
                  else if (action === "archive") setPendingArchive(detail.data);
                  else if (action === "restore") void changeStatus(detail.data, false);
                  else if (action === "duplicate") openDuplicateDraft(detail.data);
                }}
                onDirtyChange={setEditorDirty}
                onOpenChange={() => undefined}
                onSaved={(id, savedCollectionId) => {
                  setEditorDirty(false);
                  if (savedCollectionId !== collectionId)
                    void navigate(`/quizzes/${savedCollectionId}?question=${id}`);
                  else updateParams({ question: id }, false, true);
                }}
                open
                question={detail.data}
                readOnly={Boolean(summary.archivedAt || detail.data.archivedAt)}
              />
            )}
            {editor?.type === "edit" && detail.isPending && (
              <div className="flex-1 p-6">
                <Skeleton className="h-full w-full" />
              </div>
            )}
            {!editor &&
              !questions.isPending &&
              (input.status === "active" &&
              !query &&
              questions.data?.pagination.totalItems === 0 ? (
                <StudyCollectionStart
                  createLabel="Criar questão"
                  icon={SquareCheckBig}
                  noun="as primeiras questões"
                  onCreate={() => changeEditor({ type: "create" })}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                  <div>
                    <SquareCheckBig className="mx-auto mb-3 size-7" />
                    <p>Selecione uma questão ou crie uma nova.</p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </section>
      <ConfirmationDialog
        actionLabel="Arquivar"
        open={Boolean(pendingArchive)}
        title="Arquivar questão?"
        description="A questão deixará de aparecer entre os materiais ativos, mas poderá ser restaurada."
        onOpenChange={(open) => !open && setPendingArchive(null)}
        onConfirm={() => {
          if (!pendingArchive) return;
          const question = pendingArchive;
          setPendingArchive(null);
          void changeStatus(question, true);
        }}
      />
      <ConfirmationDialog
        actionLabel="Excluir"
        destructive
        open={Boolean(pendingDelete)}
        title="Excluir questão?"
        description="A questão será removida. Resultados anteriores continuarão preservados."
        onOpenChange={(open) => !open && setPendingDelete(null)}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            const id = pendingDelete.id;
            const replacementId = replacementQuestionId(new Set([id]));
            await remove.mutateAsync(id);
            if (activeId === id) showReplacement(replacementId);
            setPendingDelete(null);
            toast.success("Questão excluída.");
          } catch {
            toast.error("Não foi possível excluir a questão.");
          }
        }}
      />
      <ConfirmationDialog
        actionLabel={
          batchAction === "delete"
            ? "Excluir"
            : batchAction === "restore"
              ? "Restaurar"
              : "Arquivar"
        }
        destructive={batchAction === "delete"}
        open={Boolean(batchAction)}
        title={`${
          batchAction === "delete"
            ? "Excluir"
            : batchAction === "restore"
              ? "Restaurar"
              : "Arquivar"
        } ${selected.size} questões?`}
        description={
          batchAction === "delete"
            ? "As questões serão removidas definitivamente da coleção."
            : batchAction === "restore"
              ? "As questões voltarão a aparecer entre os materiais ativos."
              : "As questões poderão ser restauradas depois."
        }
        onOpenChange={(open) => !open && setBatchAction(null)}
        onConfirm={() => {
          if (batchAction) void performBatch(batchAction);
        }}
      />
      <QuizStartDialog collectionId={collectionId} open={startOpen} onOpenChange={setStartOpen} />
      <ConfirmationDialog
        actionLabel="Descartar"
        cancelLabel="Continuar editando"
        destructive
        open={Boolean(pendingEditor)}
        title="Descartar alterações?"
        description="A questão atual ainda não foi salva."
        onOpenChange={(open) => !open && setPendingEditor(null)}
        onConfirm={() => {
          if (!pendingEditor) return;
          const next = pendingEditor;
          setPendingEditor(null);
          setEditorDirty(false);
          if (next === "close") {
            setEditor(null);
            updateParams({ question: undefined }, false, true);
          } else {
            setEditor(next);
            updateParams({ question: next.type === "create" ? "new" : next.id }, false);
          }
        }}
      />
    </main>
  );
};

const QuizSummary = ({
  onClear,
  onDelete,
  onToggleArchive,
  selected,
  status,
}: {
  onClear: () => void;
  onDelete: () => void;
  onToggleArchive: () => void;
  selected: number;
  status: StudyCollectionStatus;
}) => (
  <StudyItemSummaryBar
    count={selected}
    itemLabel={{
      singular: "selecionada",
      plural: "selecionadas",
    }}
    onClear={onClear}
    onDelete={onDelete}
    onToggleArchive={onToggleArchive}
    status={status}
  />
);
const QuestionIndexItem = ({
  active,
  onOpen,
  onSelect,
  query,
  question,
  selected,
}: {
  active: boolean;
  onOpen: () => void;
  onSelect: (checked: boolean) => void;
  query: string;
  question: QuizQuestionSummary;
  selected: boolean;
}) => {
  const text = question.contentText.trim();
  return (
    <StudyIndexRow
      active={active}
      mark={<span className="study-index-ordinal">{question.position + 1}</span>}
      meta={
        // The answer itself stays out of the list: it could not be read here and it spoils practice.
        question.archivedAt ? "Arquivada" : `${question.optionCount} alternativas`
      }
      onOpen={onOpen}
      onSelect={onSelect}
      selectLabel={`Selecionar ${text || "questão com imagem"}`}
      selected={selected}
      title={
        text ? (
          <HighlightText query={query} text={text} />
        ) : (
          <span className="text-muted-foreground italic">Questão com imagem</span>
        )
      }
      titleText={text || undefined}
    />
  );
};
export default QuizCollectionPage;
