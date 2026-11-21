import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ChartBarIcon } from "@/components/icons.tsx";
import { ArrowRightIcon } from "@/components/icons.tsx";
import { FlashcardDomainIcon, QuizDomainIcon } from "@/components/domain-icons.ts";
import {
  studyMetricsQuerySchema,
  studyMetricsViewSchema,
  type StudyMetricsQuery,
  type StudyMetricsResponse,
  type StudyMetricsView,
} from "@lazuli/shared";
import { ContentPage } from "@/components/content-page.tsx";
import { EmptyState } from "@/components/empty-state.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { ApiError } from "@/lib/api-client.ts";
import {
  MetricsPeriod,
  MetricsCompare,
  MetricsMobileFilters,
  CollectionFilter,
  MetricsUpdating,
} from "./metrics-filters.tsx";
import { MetricsChart } from "./metrics-chart.tsx";
import { MetricsRanking, MetricsAttempts } from "./metrics-ranking.tsx";
import { useMetrics } from "./metrics-api.ts";
import { useMetricsScroll, useMetricsOnline } from "./use-metrics-window.ts";
import { formatCount, metricsPeriodFromParams, validRange } from "./metrics-format.ts";
import { MetricValue, rateValue, ResultBar, MetricsError } from "./metrics-ui.tsx";

function MetricsSummary({
  data,
  view,
}: {
  data: StudyMetricsResponse;
  view: "flashcards" | "quizzes";
}) {
  const current = data.summary,
    previous = data.previous;
  const flashcards = view === "flashcards";
  const total = current.quizAnswers;
  const correct = current.quizCorrect;
  const prevTotal = previous?.quizAnswers ?? 0;
  const prevCorrect = previous?.quizCorrect ?? 0;
  return (
    <div className="mb-5 space-y-3">
      <dl className={`grid gap-3 ${flashcards ? "grid-cols-2" : "grid-cols-3"}`}>
        {flashcards ? (
          <>
            <MetricValue
              label="Revisões"
              value={formatCount(current.evaluations)}
              previous={previous ? formatCount(previous.evaluations) : undefined}
            />
            <MetricValue
              label="Flashcards"
              value={formatCount(current.cards)}
              previous={previous ? formatCount(previous.cards) : undefined}
            />
          </>
        ) : (
          <>
            <MetricValue
              label="Acertos"
              value={rateValue(correct, total)}
              previous={
                previous ? (prevTotal ? rateValue(prevCorrect, prevTotal) : "—") : undefined
              }
            />
            <MetricValue
              label="Respostas"
              value={formatCount(current.quizAnswers)}
              previous={previous ? formatCount(previous.quizAnswers) : undefined}
            />
            <MetricValue
              label="Quizzes"
              value={formatCount(current.attempts)}
              previous={previous ? formatCount(previous.attempts) : undefined}
            />
          </>
        )}
      </dl>
      {!flashcards && total > 0 && (
        <div className="space-y-1.5">
          <ResultBar success={correct} total={total} label="Acertos" />
          <p className="text-xs text-muted-foreground">
            {correct} de {total} respostas
          </p>
        </div>
      )}
    </div>
  );
}

function DomainSummary({
  view,
  data,
  input,
  preset,
}: {
  view: "flashcards" | "quizzes";
  data: StudyMetricsResponse;
  input: StudyMetricsQuery;
  preset: string;
}) {
  const flashcards = view === "flashcards",
    Icon = flashcards ? FlashcardDomainIcon : QuizDomainIcon;
  return (
    <Button
      asChild
      variant="ghost"
      className="surface-panel surface-card-action group h-auto min-w-0 justify-start gap-3 px-4 py-4 hover:bg-card"
    >
      <Link to={`/statistics?${new URLSearchParams({ ...input, view, period: preset })}`}>
        <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
        <span className="min-w-0 text-left">
          <span className="block font-semibold">Detalhar {view}</span>
          <span className="mt-1 block text-xs font-normal text-muted-foreground">
            {flashcards
              ? `${formatCount(data.summary.cards)} flashcards estudados`
              : `${formatCount(data.summary.quizAnswers)} respostas registradas`}
          </span>
        </span>
        {/* Same page, another view: an onward arrow, not an external-link mark. */}
        <ArrowRightIcon className="ml-auto text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </Button>
  );
}

function Results({
  view,
  data,
  input,
  preset,
}: {
  view: StudyMetricsView;
  data: StudyMetricsResponse;
  input: StudyMetricsQuery;
  preset: string;
}) {
  if (view === "overview")
    return (
      <div className="grid gap-6">
        <dl className="surface-panel grid grid-cols-2 gap-6 p-5 sm:grid-cols-4 sm:p-6">
          <MetricValue
            label="Dias de estudo"
            value={formatCount(data.summary.days)}
            previous={data.previous ? formatCount(data.previous.days) : undefined}
          />
          <MetricValue
            label="Revisões de flashcards"
            value={formatCount(data.summary.evaluations)}
            previous={data.previous ? formatCount(data.previous.evaluations) : undefined}
          />
          <MetricValue
            label="Acertos em quizzes"
            value={rateValue(data.summary.quizCorrect, data.summary.quizAnswers)}
            previous={
              data.previous
                ? rateValue(data.previous.quizCorrect, data.previous.quizAnswers)
                : undefined
            }
          />
          <MetricValue
            label="Quizzes concluídos"
            value={formatCount(data.summary.attempts)}
            previous={data.previous ? formatCount(data.previous.attempts) : undefined}
          />
        </dl>
        <section className="min-w-0 surface-panel p-4 sm:p-6">
          <MetricsChart data={data} view={view} />
        </section>
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <DomainSummary view="flashcards" data={data} input={input} preset={preset} />
          <DomainSummary view="quizzes" data={data} input={input} preset={preset} />
        </div>
      </div>
    );
  return (
    <div className="grid items-start gap-5 @min-[900px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="contents min-w-0 space-y-5 @min-[900px]:block">
        <section className="order-1 min-w-0 surface-panel p-4 sm:p-5">
          <MetricsSummary data={data} view={view} />
          <MetricsChart data={data} view={view} />
        </section>
        {view === "quizzes" && (
          <div className="order-3">
            <MetricsAttempts input={input} />
          </div>
        )}
      </div>
      <MetricsRanking view={view} input={input} />
    </div>
  );
}

export default function StudyMetricsPage() {
  const online = useMetricsOnline();
  const [params, setParams] = useSearchParams();
  const [periodOpen, setPeriodOpen] = useState(false);
  const view = studyMetricsViewSchema.catch("overview").parse(params.get("view") ?? "overview");
  const { preset, from, to } = metricsPeriodFromParams(params);
  const input: StudyMetricsQuery = {
    from,
    to,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    compare: params.get("compare") === "true" ? "true" : "false",
    ...(view !== "overview" && params.get(`${view}Collection`)
      ? { collectionId: params.get(`${view}Collection`)! }
      : {}),
  };
  const valid =
    studyMetricsQuerySchema.safeParse(input).success && validRange(input.from, input.to);
  const result = useMetrics(view, input, valid);
  const key = JSON.stringify([view, input]);
  useMetricsScroll(key, result.isSuccess);
  const change = (next: StudyMetricsQuery, nextPreset = preset) =>
    setParams((p) => {
      p.set("from", next.from);
      p.set("to", next.to);
      p.set("period", nextPreset);
      if (next.compare === "true") p.set("compare", "true");
      else p.delete("compare");
      if (view !== "overview") {
        if (next.collectionId) p.set(`${view}Collection`, next.collectionId);
        else p.delete(`${view}Collection`);
      }
      for (const name of [
        "flashcardsPage",
        "flashcardsExpanded",
        "flashcardsQuestion",
        "quizzesPage",
        "quizzesExpanded",
        "quizzesQuestion",
        "attemptsPage",
        "overviewTablePage",
        "flashcardsTablePage",
        "quizzesTablePage",
      ])
        p.delete(name);
      return p;
    });
  const data = result.data;
  const practice = data
    ? view === "flashcards"
      ? data.summary.evaluations
      : view === "quizzes"
        ? data.summary.quizAnswers
        : data.summary.evaluations + data.summary.quizAnswers
    : 0;
  const unavailable = result.error instanceof ApiError && result.error.status === 404;
  return (
    <ContentPage maxWidth="6xl">
      <Tabs
        className="@container block"
        value={view}
        onValueChange={(value) =>
          setParams((p) => {
            p.set("view", value);
            return p;
          })
        }
      >
        <header className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <h1 className="page-title">Estatísticas</h1>
          {valid && (
            <div className="flex flex-wrap items-center gap-2">
              <MetricsUpdating active={result.isFetching && !result.isPending} />
              {view !== "overview" && (
                <div className="hidden min-w-0 max-w-52 @min-[640px]:block">
                  <CollectionFilter
                    view={view}
                    value={input.collectionId}
                    onChange={(collectionId) => change({ ...input, collectionId })}
                  />
                </div>
              )}
              <MetricsPeriod
                input={input}
                preset={preset}
                open={periodOpen}
                onOpenChange={setPeriodOpen}
                onChange={change}
              />
              <div className="hidden @min-[640px]:block">
                <MetricsCompare input={input} onChange={change} />
              </div>
              <div className="@min-[640px]:hidden">
                <MetricsMobileFilters view={view} input={input} onChange={change} />
              </div>
            </div>
          )}
        </header>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <TabsList variant="line" aria-label="Tipo de estatística">
            <TabsTrigger value="overview" className="min-h-11 sm:min-h-9">
              Visão geral
            </TabsTrigger>
            <TabsTrigger value="flashcards" className="min-h-11 sm:min-h-9">
              Flashcards
            </TabsTrigger>
            <TabsTrigger value="quizzes" className="min-h-11 sm:min-h-9">
              Quizzes
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value={view}>
          {valid && input.collectionId && (
            <div className="mb-3 @min-[640px]:hidden">
              <CollectionFilter
                view={view}
                value={input.collectionId}
                onChange={(collectionId) => change({ ...input, collectionId })}
              />
            </div>
          )}
          {!valid ? (
            <div role="alert" className="space-y-3">
              <p>Não foi possível usar estes filtros.</p>
              <Button variant="outline" onClick={() => setParams({ view })}>
                Restaurar filtros
              </Button>
            </div>
          ) : result.isPending ? (
            !online ? (
              <EmptyState minHeight="sm" icon={ChartBarIcon} title="Você está sem conexão." />
            ) : (
              <div
                role="status"
                aria-label="Carregando estatísticas"
                className="grid gap-5 @min-[900px]:grid-cols-[7fr_5fr]"
              >
                <Skeleton className="h-80" />
                <Skeleton className="h-64" />
              </div>
            )
          ) : result.isError && (!data || unavailable) ? (
            unavailable ? (
              <EmptyState
                minHeight="sm"
                icon={ChartBarIcon}
                title="Esta coleção não está disponível."
                action={
                  <Button
                    variant="outline"
                    onClick={() => change({ ...input, collectionId: undefined })}
                  >
                    Todas as coleções
                  </Button>
                }
              />
            ) : (
              <MetricsError
                description={
                  result.error instanceof ApiError && result.error.status === 429
                    ? "Aguarde um instante e tente novamente."
                    : undefined
                }
                title="Não foi possível carregar seus resultados"
                retry={() => void result.refetch()}
              />
            )
          ) : (
            data && (
              <div aria-busy={result.isFetching}>
                {result.isError && online && (
                  <div role="alert" className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                    <span>Não foi possível atualizar os resultados.</span>
                    <Button
                      variant="outline"
                      className="min-h-11 sm:min-h-9"
                      onClick={() => void result.refetch()}
                    >
                      Tentar novamente
                    </Button>
                  </div>
                )}
                {!online && (
                  <p role="status" className="mb-3 text-sm text-muted-foreground">
                    Sem conexão. Mostrando os últimos resultados.
                  </p>
                )}
                {!practice ? (
                  <EmptyState
                    icon={ChartBarIcon}
                    title={
                      input.collectionId
                        ? "Nenhum estudo nesta coleção neste período."
                        : data.hasHistory
                          ? "Você não estudou neste período."
                          : view === "flashcards"
                            ? "Seus resultados começam na primeira revisão."
                            : view === "quizzes"
                              ? "Conclua um quiz para ver seus resultados."
                              : "Seus resultados começam no primeiro estudo."
                    }
                    action={
                      <div className="flex flex-wrap justify-center gap-2">
                        {data.hasHistory || input.collectionId ? (
                          <>
                            <Button
                              variant="outline"
                              className="min-h-11"
                              onClick={() => setPeriodOpen(true)}
                            >
                              Alterar período
                            </Button>
                            {input.collectionId && (
                              <Button
                                variant="outline"
                                className="min-h-11"
                                onClick={() => change({ ...input, collectionId: undefined })}
                              >
                                Todas as coleções
                              </Button>
                            )}
                          </>
                        ) : (
                          <>
                            {view !== "quizzes" && (
                              <Button asChild variant="outline" className="min-h-11">
                                <Link to="/flashcards">Ver flashcards</Link>
                              </Button>
                            )}
                            {view !== "flashcards" && (
                              <Button asChild variant="outline" className="min-h-11">
                                <Link to="/quizzes">Ver quizzes</Link>
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    }
                  />
                ) : (
                  <Results key={key} view={view} data={data} input={input} preset={preset} />
                )}
              </div>
            )
          )}
        </TabsContent>
      </Tabs>
    </ContentPage>
  );
}
