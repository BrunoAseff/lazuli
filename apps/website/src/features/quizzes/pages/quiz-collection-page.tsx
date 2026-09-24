import {
  QUIZ_QUESTION_PAGE_SIZE,
  quizQuestionListQuerySchema,
  type QuizQuestionDetail,
  type QuizQuestionSummary,
} from "@lazuli/shared";
import {
  ArchiveIcon,
  ArrowLeftIcon,
  BarChart3Icon,
  CalendarPlusIcon,
  FilterIcon,
  HistoryIcon,
  ListOrderedIcon,
  PlayIcon,
  PlusIcon,
  SquareCheckBig,
  TrophyIcon,
} from "lucide-react";
import { useEffect, useState, type Ref } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { ConfirmationDialog } from "@/components/confirmation-dialog.tsx";
import { FilterSelect } from "@/components/filter-select.tsx";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { PaginationControls } from "@/components/pagination-controls.tsx";
import { SearchInput } from "@/components/search-input.tsx";
import { StudyItemSummaryBar } from "@/components/study-item-summary-bar.tsx";
import { StudyItemListState } from "@/components/study-item-list-state.tsx";
import { StudyItemTitle } from "@/components/study-item-title.tsx";
import { StudySummaryMetric } from "@/components/study-summary-metric.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useIsMobile } from "@/hooks/use-mobile.ts";
import { cn } from "@/lib/utils.ts";
import { parsePositivePage } from "@/lib/pagination.ts";
import { useQuizCollection } from "../api/quiz-collection-queries.ts";
import {
  useCreateQuizAttempt,
  useDeleteQuizQuestion,
  usePatchQuizQuestion,
  useQuizAttemptAvailability,
  useQuizQuestion,
  useQuizQuestions,
} from "../api/quiz-queries.ts";
import { QuizQuestionPanel } from "../components/quiz-question-dialog.tsx";

type EditorState = { type: "create" } | { type: "edit"; id: string } | null;
type PendingEditor = Exclude<EditorState, null> | "close" | null;

export const QuizCollectionPage = () => {
  const { collectionId = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const query = params.get("query")?.slice(0, 200).trim() ?? "";
  const linkedQuestionId = params.get("question");
  const input = quizQuestionListQuerySchema.parse({
    query,
    status: params.get("status") === "archived" ? "archived" : "active",
    sort: ["created", "position"].includes(params.get("sort") ?? "")
      ? params.get("sort")
      : "updated",
    page: parsePositivePage(params.get("page")),
    pageSize: QUIZ_QUESTION_PAGE_SIZE,
  });
  const [search, setSearch] = useState(query);
  const [selected, setSelected] = useState(new Set<string>());
  const [editor, setEditor] = useState<EditorState>(null);
  const [duplicateSource, setDuplicateSource] = useState<QuizQuestionDetail | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);
  const [pendingEditor, setPendingEditor] = useState<PendingEditor>(null);
  const [pendingDelete, setPendingDelete] = useState<QuizQuestionSummary | null>(null);
  const [pendingArchive, setPendingArchive] = useState<QuizQuestionSummary | null>(null);
  const [batchAction, setBatchAction] = useState<"archive" | "delete" | "restore" | null>(null);
  const [startOpen, setStartOpen] = useState(() => params.get("start") === "true");
  const compact = useIsMobile();
  const collection = useQuizCollection(collectionId);
  const questions = useQuizQuestions(collectionId, input);
  const availability = useQuizAttemptAvailability(collectionId);
  const detail = useQuizQuestion(collectionId, editor?.type === "edit" ? editor.id : null);
  const remove = useDeleteQuizQuestion(collectionId);
  const patchQuestion = usePatchQuizQuestion(collectionId);
  const start = useCreateQuizAttempt(collectionId);

  const updateParams = (
    changes: Record<string, string | undefined>,
    resetPage = true,
    replace = false,
  ) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const [key, value] of Object.entries(changes)) {
          if (
            !value ||
            (key === "status" && value === "active") ||
            (key === "sort" && value === "updated")
          )
            next.delete(key);
          else next.set(key, value);
        }
        if (resetPage) next.delete("page");
        return next;
      },
      { replace },
    );

  useEffect(() => {
    if (linkedQuestionId)
      setEditor(
        linkedQuestionId === "new" ? { type: "create" } : { type: "edit", id: linkedQuestionId },
      );
  }, [linkedQuestionId]);
  useEffect(() => {
    const normalized = search.trim();
    if (normalized === query) return;
    const timer = window.setTimeout(() => updateParams({ query: normalized || undefined }), 300);
    return () => window.clearTimeout(timer);
  }, [query, search]);
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
  const changeEditor = (next: Exclude<EditorState, null>) => {
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
    const activeIndex = visible.findIndex(({ id }) => id === activeId);
    const candidates =
      activeIndex >= 0
        ? [...visible.slice(activeIndex + 1), ...visible.slice(0, activeIndex)]
        : visible;
    return candidates.find(({ id }) => !excluded.has(id))?.id;
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
  const begin = async (abandonActive = false) => {
    const active = availability.data?.activeAttempt;
    if (active && !abandonActive)
      return void navigate(`/quizzes/${collectionId}/attempts/${active.id}`);
    try {
      const attempt = await start.mutateAsync({
        id: crypto.randomUUID(),
        abandonActive,
      });
      setStartOpen(false);
      await navigate(`/quizzes/${collectionId}/attempts/${attempt.id}`);
    } catch {
      toast.error("Não foi possível iniciar o quiz.");
    }
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
  const performBatch = async (action: "archive" | "delete" | "restore") => {
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
    return (
      <main className="h-[calc(100dvh-3.5rem)] p-5 md:h-dvh">
        <Skeleton className="h-full w-full" />
      </main>
    );
  if (collection.isError)
    return (
      <main className="mx-auto w-full max-w-5xl px-5 py-10">
        <h1 className="font-heading text-3xl">Coleção não encontrada</h1>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/quizzes">Voltar</Link>
        </Button>
      </main>
    );
  const summary = collection.data;
  const appliedFilters = Number(input.sort !== "updated") + Number(input.status !== "active");

  return (
    <main className="h-[calc(100dvh-3.5rem)] min-h-0 max-h-[calc(100dvh-3.5rem)] flex-none overflow-hidden md:h-dvh md:max-h-dvh">
      <section className="grid h-full min-h-0 w-full md:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[22rem_minmax(0,1fr)]">
        <aside
          className={cn(
            "min-h-0 flex-col bg-background md:flex md:border-r",
            editor ? "hidden" : "flex",
          )}
        >
          <header className="px-5 pt-5 pb-3">
            <Link
              className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground"
              to="/quizzes"
            >
              <ArrowLeftIcon className="size-3.5" /> Coleções
            </Link>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <OverflowTooltip text={summary.title}>
                  {(ref) => (
                    <h1
                      className="truncate font-heading text-xl font-normal"
                      ref={ref as Ref<HTMLHeadingElement>}
                    >
                      {summary.title}
                    </h1>
                  )}
                </OverflowTooltip>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {summary.project?.title ?? "Sem projeto"}
                </p>
              </div>
              <Button
                className="shrink-0"
                disabled={Boolean(summary.archivedAt) || availability.data?.totalQuestions === 0}
                onClick={() => setStartOpen(true)}
                size="lg"
              >
                <PlayIcon /> {availability.data?.activeAttempt ? "Continuar" : "Iniciar"}
              </Button>
            </div>
          </header>
          <div className="flex items-center gap-2 px-5 py-3">
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
                  aria-label="Filtrar e ordenar"
                  className="relative"
                  size="icon"
                  variant="outline"
                >
                  <FilterIcon />
                  {appliedFilters > 0 && (
                    <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary text-[0.625rem] text-primary-foreground">
                      {appliedFilters}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 gap-4 p-4">
                <FilterSelect
                  label="Ordenar"
                  value={input.sort}
                  onChange={(value) => updateParams({ sort: value })}
                  options={[
                    ["updated", "Atualizadas", HistoryIcon],
                    ["created", "Criadas", CalendarPlusIcon],
                    ["position", "Ordem do quiz", ListOrderedIcon],
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
                    onClick={() => updateParams({ sort: "updated", status: "active" })}
                    variant="outline"
                  >
                    Limpar filtros
                  </Button>
                )}
              </PopoverContent>
            </Popover>
            <Button
              aria-label="Nova questão"
              disabled={Boolean(summary.archivedAt)}
              onClick={() => changeEditor({ type: "create" })}
              size="icon"
            >
              <PlusIcon />
            </Button>
          </div>
          <QuizSummary
            selected={selected.size}
            summary={summary}
            onClear={() => setSelected(new Set())}
            onDelete={() => setBatchAction("delete")}
            onToggleArchive={() =>
              input.status === "active" ? setBatchAction("archive") : void performBatch("restore")
            }
            status={input.status}
          />
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2 lazuli-thin-scrollbar">
            <StudyItemListState
              createLabel="Criar questão"
              emptyIcon={SquareCheckBig}
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
              skeleton={<QuestionIndexSkeleton />}
              totalItems={questions.data?.pagination.totalItems}
            >
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
            </StudyItemListState>
          </div>
          {questions.data && questions.data.pagination.totalPages > 1 && (
            <div className="border-t px-2">
              <PaginationControls
                className="mt-0 h-16"
                label="Paginação de questões"
                onPageChange={(page) =>
                  updateParams({ page: page > 1 ? String(page) : undefined }, false)
                }
                pagination={questions.data.pagination}
              />
            </div>
          )}
        </aside>
        <div className={cn("min-h-0 min-w-0 flex-col bg-card md:flex", editor ? "flex" : "hidden")}>
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
            {!editor && !questions.isPending && (
              <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                <div>
                  <SquareCheckBig className="mx-auto mb-3 size-7" />
                  <p>Selecione uma questão ou crie uma nova.</p>
                </div>
              </div>
            )}
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
      <AlertDialog open={startOpen} onOpenChange={setStartOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {availability.data?.activeAttempt ? "Tentativa em andamento" : "Iniciar quiz?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {availability.data?.activeAttempt
                ? "Continue de onde parou ou abandone as respostas atuais e comece novamente."
                : `O quiz tem ${availability.data?.totalQuestions ?? 0} ${
                    availability.data?.totalQuestions === 1 ? "questão" : "questões"
                  }. A correção aparece após a conclusão.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-wrap">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {availability.data?.activeAttempt && (
              <Button
                disabled={start.isPending}
                onClick={() => void begin(true)}
                variant="destructive"
              >
                Abandonar e reiniciar
              </Button>
            )}
            <AlertDialogAction disabled={start.isPending} onClick={() => void begin(false)}>
              {availability.data?.activeAttempt ? "Continuar" : "Iniciar quiz"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  summary,
}: {
  onClear: () => void;
  onDelete: () => void;
  onToggleArchive: () => void;
  selected: number;
  status: "active" | "archived";
  summary: {
    totalQuestions: number;
    totalAttempts: number;
    bestScoreRate: number | null;
    lastScore: { rate: number } | null;
  };
}) => (
  <StudyItemSummaryBar
    count={selected}
    itemLabel={{
      singular: "questão selecionada",
      plural: "questões selecionadas",
    }}
    onClear={onClear}
    onDelete={onDelete}
    onToggleArchive={onToggleArchive}
    status={status}
  >
    <StudySummaryMetric icon={SquareCheckBig} strong>
      {summary.totalQuestions} {summary.totalQuestions === 1 ? "questão" : "questões"}
    </StudySummaryMetric>
    <StudySummaryMetric icon={HistoryIcon}>
      {summary.totalAttempts} {summary.totalAttempts === 1 ? "tentativa" : "tentativas"}
    </StudySummaryMetric>
    <StudySummaryMetric icon={BarChart3Icon}>
      Última: {summary.lastScore ? `${Math.round(summary.lastScore.rate * 100)}%` : "—"}
    </StudySummaryMetric>
    <StudySummaryMetric icon={TrophyIcon}>
      Melhor: {summary.bestScoreRate === null ? "—" : `${Math.round(summary.bestScoreRate * 100)}%`}
    </StudySummaryMetric>
  </StudyItemSummaryBar>
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
}) => (
  <article
    className={cn(
      "group flex items-start gap-2 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent/50",
      active && "bg-accent",
    )}
  >
    <Checkbox
      aria-label={`Selecionar ${question.contentText || "questão"}`}
      checked={selected}
      className="mt-1"
      onCheckedChange={(checked) => onSelect(checked === true)}
    />
    <button className="min-w-0 flex-1 text-left" onClick={onOpen} type="button">
      <StudyItemTitle query={query} text={question.contentText} />
      <p className="mt-1 truncate text-[0.6875rem] text-muted-foreground">
        {question.optionCount} alternativas · {question.archivedAt ? "Arquivada" : "Ativa"}
      </p>
    </button>
  </article>
);
const QuestionIndexSkeleton = () => (
  <div className="space-y-2 p-2">
    {Array.from({ length: 7 }, (_, index) => (
      <Skeleton className="h-14 w-full" key={index} />
    ))}
  </div>
);
export default QuizCollectionPage;
