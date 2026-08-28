import {
  QUIZ_QUESTION_PAGE_SIZE,
  quizQuestionListQuerySchema,
  type QuizQuestionSummary,
} from "@lazuli/shared";
import {
  ArchiveIcon,
  ArrowLeftIcon,
  CalendarIcon,
  CalendarPlusIcon,
  HistoryIcon,
  ImageIcon,
  ListChecksIcon,
  ListOrderedIcon,
  MoreHorizontalIcon,
  MoveRightIcon,
  PencilIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useEffect, useState, type Ref } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

import { HighlightText } from "@/components/highlight-text.tsx";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { PaginationControls } from "@/components/pagination-controls.tsx";
import { StudyItemActions, StudyItemShell } from "@/components/study-item-shell.tsx";
import { ViewModeToggle, type ViewMode } from "@/components/view-mode-toggle.tsx";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useQuizCollection } from "../api/quiz-collection-queries.ts";
import {
  useCreateQuizAttempt,
  useDeleteQuizQuestion,
  usePatchQuizQuestion,
  useQuizAttemptAvailability,
  useQuizQuestion,
  useQuizQuestions,
} from "../api/quiz-queries.ts";
import { QuizQuestionDialog } from "../components/quiz-question-dialog.tsx";

const parsePage = (value: string | null) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
};
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });

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
    page: parsePage(params.get("page")),
    pageSize: QUIZ_QUESTION_PAGE_SIZE,
  });
  const [search, setSearch] = useState(query);
  const [view, setView] = useState<ViewMode>(() =>
    localStorage.getItem("lazuli-quiz-question-view") === "cards" ? "cards" : "table",
  );
  const [editor, setEditor] = useState<{ type: "create" } | { type: "edit"; id: string } | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<QuizQuestionSummary | null>(null);
  const [startOpen, setStartOpen] = useState(() => params.get("start") === "true");
  const collection = useQuizCollection(collectionId);
  const questions = useQuizQuestions(collectionId, input);
  const availability = useQuizAttemptAvailability(collectionId);
  const detail = useQuizQuestion(collectionId, editor?.type === "edit" ? editor.id : null);
  const remove = useDeleteQuizQuestion(collectionId);
  const start = useCreateQuizAttempt(collectionId);
  const patchQuestion = usePatchQuizQuestion(collectionId);
  useEffect(() => {
    if (linkedQuestionId) setEditor({ type: "edit", id: linkedQuestionId });
  }, [linkedQuestionId]);
  const updateParams = (changes: Record<string, string | undefined>, reset = true) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      for (const [key, value] of Object.entries(changes))
        if (
          !value ||
          (key === "status" && value === "active") ||
          (key === "sort" && value === "updated")
        )
          next.delete(key);
        else next.set(key, value);
      if (reset) next.delete("page");
      return next;
    });
  useEffect(() => setSearch(query), [query]);
  useEffect(() => {
    const normalized = search.trim();
    if (normalized === query) return;
    const timer = window.setTimeout(() => updateParams({ query: normalized || undefined }), 300);
    return () => window.clearTimeout(timer);
  }, [query, search]);
  const begin = async (abandonActive = false) => {
    const active = availability.data?.activeAttempt;
    if (active && !abandonActive) {
      await navigate(`/quizzes/${collectionId}/attempts/${active.id}`);
      return;
    }
    try {
      const attempt = await start.mutateAsync({ id: crypto.randomUUID(), abandonActive });
      setStartOpen(false);
      await navigate(`/quizzes/${collectionId}/attempts/${attempt.id}`);
    } catch {
      toast.error("Não foi possível iniciar o quiz.");
    }
  };
  const action = async (type: "archive" | "restore", question: QuizQuestionSummary) => {
    try {
      await patchQuestion.mutateAsync({
        questionId: question.id,
        input: { archived: type === "archive" },
      });
      toast.success(type === "archive" ? "Questão arquivada." : "Questão restaurada.");
    } catch {
      toast.error("Não foi possível atualizar a questão.");
    }
  };
  if (collection.isPending)
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-10">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  if (collection.isError)
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-10">
        <h1 className="font-heading text-3xl">Coleção não encontrada</h1>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/quizzes">Voltar</Link>
        </Button>
      </main>
    );
  const summary = collection.data;
  return (
    <main className="flex flex-1 flex-col px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
      <div className="mx-auto w-full max-w-6xl">
        <Link
          className="mb-7 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          to="/quizzes"
        >
          <ArrowLeftIcon className="size-4" /> Quizzes
        </Link>
        <header className="flex flex-col gap-6 border-b pb-7 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Coleção de quiz
            </p>
            <h1 className="truncate font-heading text-4xl font-medium sm:text-5xl">
              {summary.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {summary.project?.title ?? "Sem projeto"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={Boolean(summary.archivedAt)}
              onClick={() => setEditor({ type: "create" })}
              variant="outline"
            >
              <PlusIcon /> Nova questão
            </Button>
            <Button
              disabled={Boolean(summary.archivedAt) || availability.data?.totalQuestions === 0}
              onClick={() => setStartOpen(true)}
              title={
                availability.data?.totalQuestions === 0
                  ? "Crie ao menos uma questão para iniciar."
                  : undefined
              }
            >
              <PlayIcon />{" "}
              {availability.data?.activeAttempt ? "Continuar tentativa" : "Iniciar quiz"}
            </Button>
          </div>
        </header>
        <section
          aria-label="Resumo da coleção"
          className="grid grid-cols-2 gap-px border-b bg-border md:grid-cols-4"
        >
          <Metric label="Questões" value={summary.totalQuestions} />
          <Metric label="Tentativas" value={summary.totalAttempts} />
          <Metric
            label="Última pontuação"
            value={summary.lastScore ? `${Math.round(summary.lastScore.rate * 100)}%` : "—"}
          />
          <Metric
            label="Melhor pontuação"
            value={
              summary.bestScoreRate === null ? "—" : `${Math.round(summary.bestScoreRate * 100)}%`
            }
          />
        </section>
        <div className="my-7 flex flex-col gap-3 border-y py-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Pesquisar questões"
              className="pr-9 pl-9"
              maxLength={200}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar questões"
              value={search}
            />
            {search && (
              <Button
                aria-label="Limpar pesquisa"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                onClick={() => {
                  setSearch("");
                  updateParams({ query: undefined });
                }}
                size="icon-sm"
                variant="ghost"
              >
                <XIcon />
              </Button>
            )}
          </div>
          <Select onValueChange={(value) => updateParams({ sort: value })} value={input.sort}>
            <SelectTrigger className="w-full lg:w-44">
              <SelectValue>
                {input.sort === "updated" ? (
                  <HistoryIcon />
                ) : input.sort === "created" ? (
                  <CalendarPlusIcon />
                ) : (
                  <ListOrderedIcon />
                )}
                {
                  (
                    {
                      updated: "Atualizadas",
                      created: "Criadas",
                      position: "Ordem do quiz",
                    } as const
                  )[input.sort]
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">
                <HistoryIcon /> Atualizadas
              </SelectItem>
              <SelectItem value="created">
                <CalendarPlusIcon /> Criadas
              </SelectItem>
              <SelectItem value="position">
                <ListOrderedIcon /> Ordem do quiz
              </SelectItem>
            </SelectContent>
          </Select>
          <Select onValueChange={(value) => updateParams({ status: value })} value={input.status}>
            <SelectTrigger className="w-full lg:w-36">
              <SelectValue>
                {input.status === "active" ? <ListOrderedIcon /> : <ArchiveIcon />}
                {input.status === "active" ? "Ativas" : "Arquivadas"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">
                <ListOrderedIcon /> Ativas
              </SelectItem>
              <SelectSeparator />
              <SelectItem value="archived">
                <ArchiveIcon /> Arquivadas
              </SelectItem>
            </SelectContent>
          </Select>
          <div className="lg:ml-auto">
            <ViewModeToggle
              label="Visualização das questões"
              onChange={(next) => {
                setView(next);
                localStorage.setItem("lazuli-quiz-question-view", next);
              }}
              value={view}
            />
          </div>
        </div>
        {questions.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : questions.isError ? (
          <div className="border border-dashed px-6 py-14 text-center">
            <h2 className="font-heading text-2xl">Não foi possível carregar as questões</h2>
            <Button className="mt-4" onClick={() => void questions.refetch()} variant="outline">
              Tentar novamente
            </Button>
          </div>
        ) : !questions.data?.items.length ? (
          <div className="border border-dashed px-6 py-16 text-center">
            <h2 className="font-heading text-2xl">
              {query
                ? "Nenhuma questão encontrada"
                : input.status === "archived"
                  ? "Nenhuma questão arquivada"
                  : "Nenhuma questão ainda"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {query
                ? "Tente pesquisar por outro termo."
                : "Crie a primeira questão para iniciar este quiz."}
            </p>
          </div>
        ) : (
          <div
            className={
              view === "cards" ? "grid gap-3 md:grid-cols-2 xl:grid-cols-3" : "divide-y border-y"
            }
          >
            {questions.data.items.map((question) => (
              <QuestionItem
                key={question.id}
                mode={view}
                onAction={(type) =>
                  type === "edit" || type === "move"
                    ? setEditor({ type: "edit", id: question.id })
                    : type === "delete"
                      ? setPendingDelete(question)
                      : void action(type, question)
                }
                query={query}
                question={question}
              />
            ))}
          </div>
        )}
        {questions.data && (
          <PaginationControls
            label="Paginação de questões"
            onPageChange={(page) =>
              updateParams({ page: page > 1 ? String(page) : undefined }, false)
            }
            pagination={questions.data.pagination}
          />
        )}
      </div>
      {editor && (editor.type === "create" || detail.data) && (
        <QuizQuestionDialog
          collectionId={collectionId}
          onOpenChange={(open) => {
            if (open) return;
            setEditor(null);
            updateParams({ question: undefined }, false);
          }}
          open
          question={editor.type === "edit" ? detail.data : undefined}
        />
      )}
      <AlertDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir questão?</AlertDialogTitle>
            <AlertDialogDescription>
              A questão será removida da coleção. Resultados anteriores continuarão preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (!pendingDelete) return;
                try {
                  await remove.mutateAsync(pendingDelete.id);
                  toast.success("Questão excluída.");
                  setPendingDelete(null);
                } catch {
                  toast.error("Não foi possível excluir a questão.");
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={startOpen} onOpenChange={setStartOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {availability.data?.activeAttempt ? "Tentativa em andamento" : "Iniciar quiz?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {availability.data?.activeAttempt
                ? "Você pode continuar de onde parou ou abandonar as respostas atuais e começar novamente."
                : `Este quiz possui ${availability.data?.totalQuestions ?? 0} ${availability.data?.totalQuestions === 1 ? "questão" : "questões"}. As respostas serão corrigidas somente após a conclusão.`}
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
                Abandonar e iniciar outra
              </Button>
            )}
            <AlertDialogAction disabled={start.isPending} onClick={() => void begin(false)}>
              {availability.data?.activeAttempt ? "Continuar" : "Iniciar quiz"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
};

const QuestionItem = ({
  mode,
  onAction,
  query,
  question,
}: {
  mode: ViewMode;
  onAction: (type: "archive" | "delete" | "edit" | "move" | "restore") => void;
  query: string;
  question: QuizQuestionSummary;
}) => (
  <StudyItemShell
    className={
      mode === "table" ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_8rem_10rem_auto]" : undefined
    }
    mode={mode}
  >
    <button
      className={`min-w-0 text-left ${mode === "cards" ? "mb-5 pr-8" : ""}`}
      onClick={() => onAction("edit")}
      type="button"
    >
      <p className="mb-1 flex items-center gap-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Pergunta
        {question.hasImage && <ImageIcon aria-label="Pergunta com imagem" className="size-3.5" />}
      </p>
      <OverflowTooltip text={question.contentText || "Pergunta com imagem"}>
        {(ref) => (
          <h2
            className={
              mode === "cards"
                ? "line-clamp-3 font-heading text-xl font-medium"
                : "truncate font-heading text-lg font-medium"
            }
            ref={ref as Ref<HTMLHeadingElement>}
          >
            <HighlightText query={query} text={question.contentText || "Pergunta com imagem"} />
          </h2>
        )}
      </OverflowTooltip>
    </button>
    <button className="min-w-0 text-left" onClick={() => onAction("edit")} type="button">
      <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Resposta correta
      </p>
      <OverflowTooltip text={question.correctOptionText}>
        {(ref) => (
          <p
            className={
              mode === "cards"
                ? "line-clamp-3 text-muted-foreground"
                : "truncate text-muted-foreground"
            }
            ref={ref as Ref<HTMLParagraphElement>}
          >
            {question.correctOptionText}
          </p>
        )}
      </OverflowTooltip>
    </button>
    {mode === "cards" ? (
      <div className="mt-auto flex min-w-0 items-center gap-4 pt-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <ListChecksIcon aria-hidden="true" className="size-3.5 text-muted-foreground/80" />
          {question.optionCount} alternativas
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <CalendarIcon aria-hidden="true" className="size-3.5 text-muted-foreground/80" />
          {dateFormatter.format(new Date(question.updatedAt))}
        </span>
      </div>
    ) : (
      <>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <ListChecksIcon aria-hidden="true" className="size-3.5 text-muted-foreground/80" />
          {question.optionCount} alternativas
        </span>
        <span className="flex items-center gap-1.5 whitespace-nowrap">
          <CalendarIcon aria-hidden="true" className="size-3.5 text-muted-foreground/80" />
          {dateFormatter.format(new Date(question.updatedAt))}
        </span>
      </>
    )}
    <StudyItemActions mode={mode}>
      <QuestionActions archived={Boolean(question.archivedAt)} onAction={onAction} />
    </StudyItemActions>
  </StudyItemShell>
);
const QuestionActions = ({
  archived,
  onAction,
}: {
  archived: boolean;
  onAction: (type: "archive" | "delete" | "edit" | "move" | "restore") => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button aria-label="Ações da questão" size="icon-sm" variant="ghost">
        <MoreHorizontalIcon />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={() => onAction("edit")}>
        <PencilIcon /> Editar
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onAction("move")}>
        <MoveRightIcon /> Mover
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={() => onAction(archived ? "restore" : "archive")}>
        {archived ? <RotateCcwIcon /> : <ArchiveIcon />}
        {archived ? "Restaurar" : "Arquivar"}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => onAction("delete")} variant="destructive">
        <Trash2Icon /> Excluir
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
const Metric = ({ label, value }: { label: string; value: number | string }) => (
  <div className="bg-background px-4 py-5">
    <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
    <p className="mt-1 font-heading text-2xl">{value}</p>
  </div>
);
export default QuizCollectionPage;
