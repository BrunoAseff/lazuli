import { useRef } from "react";
import { Link, useSearchParams } from "react-router";
import type { StudyMetricsQuery } from "@lazuli/shared";
import { ChartBarIcon } from "@phosphor-icons/react/ChartBar";
import { SlidersHorizontalIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { EmptyState } from "@/components/empty-state.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible.tsx";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu.tsx";
import { useMetricsAttempts, useMetricsRanking } from "./metrics-api.ts";
import { formatCount } from "./metrics-format.ts";
import { MetricsError, MetricsPagination, ResultBar } from "./metrics-ui.tsx";

const pageNumber = (value: string | null) =>
  Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 10000
    ? Number(value)
    : 1;

function QuestionText({
  text,
  expanded,
  onToggle,
}: {
  text: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const long = text.length > 180;
  return (
    <Collapsible open={expanded} onOpenChange={onToggle}>
      <p
        className={`break-words text-sm leading-relaxed ${long && !expanded ? "line-clamp-3" : ""}`}
      >
        {!expanded && (text || "Material sem texto")}
      </p>
      {expanded && (
        <CollapsibleContent>
          <p className="break-words text-sm leading-relaxed">{text}</p>
        </CollapsibleContent>
      )}
      {long && (
        <CollapsibleTrigger asChild>
          <Button variant="link" className="min-h-11 px-0 text-xs sm:min-h-8">
            {expanded ? "Recolher" : "Ler enunciado"}
          </Button>
        </CollapsibleTrigger>
      )}
    </Collapsible>
  );
}

export function MetricsRanking({
  view,
  input,
}: {
  view: "flashcards" | "quizzes";
  input: StudyMetricsQuery;
}) {
  const [params, setParams] = useSearchParams();
  const section = useRef<HTMLElement>(null);
  const page = pageNumber(params.get(`${view}Page`));
  const archived = params.get(`${view}Archived`) === "true";
  const order =
    view === "quizzes" && params.get(`${view}Order`) === "correct" ? "correct" : "errors";
  const update = (values: Record<string, string | undefined>) =>
    setParams(
      (p) => {
        for (const [key, value] of Object.entries(values)) {
          if (value) p.set(`${view}${key}`, value);
          else p.delete(`${view}${key}`);
        }
        return p;
      },
      { replace: true },
    );
  const goPage = (value: number) => {
    update({ Page: String(value) });
    requestAnimationFrame(() =>
      section.current?.scrollIntoView({ block: "nearest", behavior: "auto" }),
    );
  };
  const result = useMetricsRanking(view, input, page, archived, order);
  const title =
    view === "flashcards"
      ? "Flashcards com dificuldade"
      : order === "correct"
        ? "Perguntas com mais acertos"
        : "Perguntas com mais erros";
  const reason = result.data?.emptyReason;
  const emptyTitle =
    reason === "outOfRange"
      ? "Não há mais resultados nesta página."
      : reason === "onlyArchived"
        ? "Os resultados desta lista estão nos seus materiais arquivados."
        : reason === "noPractice"
          ? view === "flashcards"
            ? "Seus resultados começam na primeira revisão."
            : "Conclua um quiz para ver seus resultados."
          : reason === "initial"
            ? view === "flashcards"
              ? "Suas dificuldades vão aparecer aqui conforme você revisar."
              : "Suas próximas tentativas vão mostrar quais perguntas merecem atenção."
            : reason === "noSuccess"
              ? "Nenhum acerto por aqui ainda. Que tal tentar de novo?"
              : view === "flashcards"
                ? "Você não está com dificuldade em nenhum flashcard. Bom trabalho!"
                : "Você acertou todas as respostas por aqui. Bom trabalho!";
  return (
    <section
      ref={section}
      aria-label={title}
      className="order-2 min-w-0 scroll-mt-20 rounded-xl bg-card/50 p-4 sm:p-5"
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-heading text-xl leading-snug">{title}</h2>
          {archived && (
            <Button
              variant="ghost"
              className="mt-1 min-h-11 gap-1 text-xs sm:min-h-9"
              onClick={() => update({ Archived: undefined, Page: undefined })}
            >
              Com arquivados
              <XIcon className="size-3" />
            </Button>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label="Opções da lista"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0 sm:size-9"
            >
              <SlidersHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuCheckboxItem
              className="min-h-11"
              checked={archived}
              onCheckedChange={(v) => update({ Archived: v ? "true" : undefined, Page: undefined })}
            >
              Incluir arquivados
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {view === "quizzes" && (
        <Tabs
          value={order}
          onValueChange={(value) => update({ Order: value, Page: undefined })}
          className="mb-4"
        >
          <TabsList aria-label="Ordenar perguntas" className="w-full">
            <TabsTrigger value="errors" className="min-h-11 sm:min-h-9">
              Mais erros
            </TabsTrigger>
            <TabsTrigger value="correct" className="min-h-11 sm:min-h-9">
              Mais acertos
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}
      {result.isPending ? (
        <Skeleton className="h-48" />
      ) : result.isError ? (
        <MetricsError
          message="Não foi possível carregar esta lista."
          retry={() => void result.refetch()}
        />
      ) : !result.data.items.length ? (
        <EmptyState
          compact
          minHeight="sm"
          icon={ChartBarIcon}
          title={emptyTitle}
          action={
            reason === "outOfRange" ? (
              <Button variant="outline" className="min-h-11" onClick={() => goPage(1)}>
                Voltar à primeira página
              </Button>
            ) : reason === "onlyArchived" ? (
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => update({ Archived: "true", Page: undefined })}
              >
                Incluir arquivados
              </Button>
            ) : reason === "noPractice" || reason === "noSuccess" ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link to={`/${view}`}>Ver {view}</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul className="divide-y divide-border/40">
            {result.data.items.map((item) => {
              const count = order === "correct" ? item.successes : item.failures;
              return (
                <li key={item.id} className="space-y-2.5 py-4 first:pt-0">
                  <QuestionText
                    text={item.title}
                    expanded={params.get(`${view}Question`) === item.id}
                    onToggle={() =>
                      update({
                        Question: params.get(`${view}Question`) === item.id ? undefined : item.id,
                      })
                    }
                  />
                  {(!input.collectionId || item.archived || item.historical) && (
                    <p className="break-words text-xs text-muted-foreground">
                      {[
                        !input.collectionId ? item.collection : null,
                        item.archived ? "Arquivado" : null,
                        item.removed
                          ? "Pergunta removida"
                          : item.historical
                            ? "Versão anterior"
                            : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2 text-xs">
                      <p className="tabular-nums">
                        {view === "flashcards"
                          ? "Não lembrou em"
                          : order === "correct"
                            ? "Acertou"
                            : "Errou"}{" "}
                        {formatCount(count)} de {formatCount(item.total)}{" "}
                        {view === "flashcards" ? "revisões" : "vezes"}
                      </p>
                      <ResultBar
                        success={count}
                        total={item.total}
                        label={
                          view === "flashcards"
                            ? "Não lembrou"
                            : order === "correct"
                              ? "Acertos"
                              : "Erros"
                        }
                        failure={order !== "correct"}
                      />
                    </div>
                    <Button asChild variant="outline" className="min-h-11 sm:min-h-9">
                      <Link to={view === "quizzes" ? item.historicalHref || item.href : item.href}>
                        {view === "quizzes" ? "Ver resposta" : "Abrir flashcard"}
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <MetricsPagination
            page={page}
            hasMore={result.data.hasMore}
            onPage={goPage}
            label={`Páginas de ${title.toLowerCase()}`}
          />
        </>
      )}
    </section>
  );
}

export function MetricsAttempts({ input }: { input: StudyMetricsQuery }) {
  const [params, setParams] = useSearchParams();
  const full = params.get("attempts") === "true",
    page = full ? pageNumber(params.get("attemptsPage")) : 1;
  const result = useMetricsAttempts(input, page, !full);
  const completedDay = (value: string) => new Date(value).toLocaleDateString("pt-BR");
  const dayCounts = new Map<string, number>();
  for (const item of result.data?.items ?? []) {
    const day = completedDay(item.completedAt);
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }
  const update = (value: boolean, page = 1) =>
    setParams(
      (p) => {
        if (value) {
          p.set("attempts", "true");
          p.set("attemptsPage", String(page));
        } else {
          p.delete("attempts");
          p.delete("attemptsPage");
        }
        return p;
      },
      { replace: true },
    );
  return (
    <section className="rounded-xl bg-card/50 p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-xl">
          {full ? "Histórico de quizzes" : "Últimos quizzes"}
        </h2>
        {(full || result.data?.hasMore) && (
          <Button
            variant="ghost"
            className="min-h-11 px-2 sm:min-h-9"
            onClick={() => update(!full)}
          >
            {full ? "Mostrar recentes" : "Ver todos"}
          </Button>
        )}
      </div>
      {result.isPending ? (
        <Skeleton className="h-32" />
      ) : result.isError ? (
        <MetricsError
          message="Não foi possível carregar o histórico."
          retry={() => void result.refetch()}
        />
      ) : !result.data.items.length ? (
        <EmptyState
          compact
          minHeight="sm"
          icon={ChartBarIcon}
          title={
            page > 1
              ? "Não há mais resultados nesta página."
              : "Conclua um quiz para ver seus resultados."
          }
          action={
            page > 1 ? (
              <Button variant="outline" onClick={() => update(true)}>
                Voltar à primeira página
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <ul className="divide-y divide-border/40">
            {result.data.items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1 space-y-2">
                  {!input.collectionId && <p className="break-words text-sm">{item.collection}</p>}
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {new Date(item.completedAt).toLocaleDateString("pt-BR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {(dayCounts.get(completedDay(item.completedAt)) ?? 0) > 1 &&
                        ` · ${new Date(item.completedAt).toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`}
                    </span>
                    <span className="tabular-nums">
                      {item.correct}/{item.total} acertos
                    </span>
                  </div>
                  <ResultBar success={item.correct} total={item.total} label="Acertos" />
                </div>
                <Button asChild variant="outline" className="min-h-11 sm:min-h-9">
                  <Link to={item.href}>Ver respostas</Link>
                </Button>
              </li>
            ))}
          </ul>
          {full && (
            <MetricsPagination
              page={page}
              hasMore={result.data.hasMore}
              onPage={(value) => update(true, value)}
              label="Páginas do histórico de quizzes"
            />
          )}
        </>
      )}
    </section>
  );
}
