import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { ChartBarIcon } from "@phosphor-icons/react/ChartBar";
import { ArrowUpRightIcon } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
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
  const count = flashcards ? data.summary.evaluations : data.summary.attempts;
  return (
    <section className="min-w-0 rounded-xl bg-card/60 p-3 sm:p-5">
      <h2 className="mb-4 flex items-center gap-2 font-heading text-xl">
        <Icon className="size-5 text-primary" />
        {flashcards ? "Flashcards" : "Quizzes"}
      </h2>
      {count ? (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-3">
            <MetricValue
              label={flashcards ? "Revisões" : "Acertos"}
              value={
                flashcards
                  ? formatCount(count)
                  : rateValue(data.summary.quizCorrect, data.summary.quizAnswers)
              }
              previous={
                data.previous
                  ? flashcards
                    ? formatCount(data.previous.evaluations)
                    : rateValue(data.previous.quizCorrect, data.previous.quizAnswers)
                  : undefined
              }
            />
            <MetricValue
              label={flashcards ? "Flashcards" : "Quizzes"}
              value={formatCount(flashcards ? data.summary.cards : count)}
            />
          </dl>
          {!flashcards && (
            <div className="space-y-1.5">
              <ResultBar
                success={data.summary.quizCorrect}
                total={data.summary.quizAnswers}
                label="Acertos"
              />
              <p className="text-xs text-muted-foreground">
                {data.summary.quizCorrect} de {data.summary.quizAnswers} respostas
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="py-3 text-sm text-muted-foreground">
          {flashcards
            ? "Seus resultados começam na primeira revisão."
            : "Conclua um quiz para ver seus resultados."}
        </p>
      )}
      <Button asChild variant="ghost" className="mt-3 min-h-11 text-xs sm:min-h-9 sm:text-sm">
        <Link to={`/statistics?${new URLSearchParams({ ...input, view, period: preset })}`}>
          Ver {view}
          <ArrowUpRightIcon />
        </Link>
      </Button>
    </section>
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
      <div className="grid items-start gap-5 @min-[900px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <section className="order-2 min-w-0 rounded-xl bg-card/50 p-4 sm:p-5 @min-[900px]:order-1">
          <dl className="mb-5">
            <MetricValue
              label="Dias de estudo"
              value={formatCount(data.summary.days)}
              previous={data.previous ? formatCount(data.previous.days) : undefined}
            />
          </dl>
          <MetricsChart data={data} view={view} />
        </section>
        <div className="order-1 grid min-w-0 grid-cols-2 gap-3 @min-[900px]:order-2 @min-[900px]:grid-cols-1">
          <DomainSummary view="flashcards" data={data} input={input} preset={preset} />
          <DomainSummary view="quizzes" data={data} input={input} preset={preset} />
        </div>
      </div>
    );
  return (
    <div className="grid items-start gap-5 @min-[900px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
      <div className="contents min-w-0 space-y-5 @min-[900px]:block">
        <section className="order-1 min-w-0 rounded-xl bg-card/50 p-4 sm:p-5">
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
      <div className="@container">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <h1 className="font-heading text-3xl font-medium tracking-tight sm:text-4xl">
            Estatísticas
          </h1>
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
          <Tabs
            value={view}
            onValueChange={(value) =>
              setParams((p) => {
                p.set("view", value);
                return p;
              })
            }
          >
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
          </Tabs>
        </div>
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
              message={
                result.error instanceof ApiError && result.error.status === 429
                  ? "Aguarde um instante e tente novamente."
                  : "Não foi possível carregar seus resultados."
              }
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
      </div>
    </ContentPage>
  );
}
