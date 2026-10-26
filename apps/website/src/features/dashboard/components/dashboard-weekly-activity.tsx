import type { DashboardResponse } from "@lazuli/shared";
import { ChartBarIcon } from "@phosphor-icons/react/ChartBar";
import { Link } from "react-router";
import { useState } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import { chartTooltipClass, ChartTooltipValues } from "@/components/chart-tooltip.tsx";
import { DashboardSectionTitle } from "./dashboard-section-title.tsx";

const dayFormatter = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  timeZone: "UTC",
});
const fullDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 0,
});
const toDate = (date: string) => new Date(`${date}T12:00:00.000Z`);
const emptyHeights = [32, 58, 43, 72, 51, 84, 66];

const flashcardReviewCount = (count: number) =>
  `${count} ${count === 1 ? "flashcard revisado" : "flashcards revisados"}`;

const quizAnswerCount = (count: number) =>
  `${count} ${count === 1 ? "questão respondida" : "questões respondidas"}`;

export const DashboardWeeklyActivity = ({
  activity,
}: {
  activity: DashboardResponse["weeklyActivity"];
}) => {
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const maximum = Math.max(...activity.days.map(({ total }) => total), 1);
  const flashcardTotal = activity.days.reduce((total, day) => total + day.flashcardReviews, 0);
  const quizTotal = activity.days.reduce((total, day) => total + day.quizAnswers, 0);
  const activitySummary = [
    flashcardTotal > 0 ? flashcardReviewCount(flashcardTotal) : null,
    quizTotal > 0 ? quizAnswerCount(quizTotal) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      aria-labelledby="dashboard-weekly-title"
      className="flex h-full min-h-80 flex-col px-3 py-5 sm:px-5 sm:py-6"
    >
      <DashboardSectionTitle
        action={<span className="pt-1 text-xs text-muted-foreground">7 dias</span>}
        icon={<ChartBarIcon aria-hidden="true" className="size-6" weight="duotone" />}
        id="dashboard-weekly-title"
        title="Ritmo de estudo"
      />

      {activity.totalItems === 0 ? (
        <div className="relative flex flex-1 flex-col justify-end pt-7" role="status">
          <p className="absolute inset-x-0 top-1/2 z-10 -translate-y-1/2 text-center font-heading text-xl">
            Ainda não há dados
          </p>
          <div aria-hidden="true" className="opacity-[0.08]">
            <div className="grid h-40 grid-cols-7 items-end gap-3">
              {emptyHeights.map((height, index) => (
                <span
                  className="w-full rounded-t-sm bg-primary"
                  key={activity.days[index]?.date}
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <div className="mt-2 grid grid-cols-7 gap-3 text-center">
              {activity.days.map((day) => (
                <span className="text-[0.68rem] capitalize" key={day.date}>
                  {dayFormatter.format(toDate(day.date)).replace(".", "")}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col pt-1">
          <p className="mt-1 text-sm text-muted-foreground">{activitySummary}</p>

          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rounded-sm bg-primary" />
              Revisões de flashcards
            </span>
            <span className="inline-flex items-center gap-2">
              <span aria-hidden="true" className="size-2.5 rounded-sm bg-[var(--warning)]" />
              Respostas em quizzes
            </span>
          </div>

          <figure className="mt-4 flex flex-1 flex-col justify-end">
            <div className="relative h-32">
              <div
                aria-hidden="true"
                className="absolute inset-0 flex flex-col justify-between pb-px"
              >
                <span className="border-t border-border/45" />
                <span className="border-t border-border/45" />
                <span className="border-t border-border/45" />
                <span className="border-t border-border/45" />
              </div>
              <div className="absolute inset-0 grid grid-cols-7 items-end gap-2 sm:gap-3">
                {activity.days.map((day) => {
                  const height = day.total ? Math.max(12, (day.total / maximum) * 100) : 3;
                  const flashcardShare = day.total ? (day.flashcardReviews / day.total) * 100 : 0;
                  const date = fullDateFormatter.format(toDate(day.date));
                  const accessibleLabel = `${date}: ${flashcardReviewCount(day.flashcardReviews)} e ${quizAnswerCount(day.quizAnswers)}`;
                  return (
                    <Tooltip
                      key={day.date}
                      open={activeDay === day.date}
                      onOpenChange={(open) =>
                        setActiveDay((current) =>
                          open ? day.date : current === day.date ? null : current,
                        )
                      }
                    >
                      <TooltipTrigger asChild>
                        <button
                          aria-label={accessibleLabel}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                          }}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setActiveDay((current) => (current === day.date ? null : day.date));
                          }}
                          className="group flex h-full items-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          type="button"
                        >
                          <span
                            className="flex w-full flex-col-reverse overflow-hidden rounded-t-md bg-border/60 transition-opacity group-hover:opacity-75 group-focus-visible:opacity-75"
                            style={{ height: `${height}%` }}
                          >
                            {day.total > 0 && (
                              <>
                                <span
                                  className="bg-primary"
                                  style={{ height: `${flashcardShare}%` }}
                                />
                                <span
                                  className="bg-[var(--warning)]"
                                  style={{ height: `${100 - flashcardShare}%` }}
                                />
                              </>
                            )}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        sideOffset={6}
                        className={chartTooltipClass}
                        hideArrow
                      >
                        <ChartTooltipValues
                          title={date}
                          items={[
                            {
                              label: "Revisões de flashcards",
                              value: day.flashcardReviews,
                              color: "var(--primary)",
                            },
                            {
                              label: "Respostas de quizzes",
                              value: day.quizAnswers,
                              color: "var(--warning)",
                            },
                          ]}
                        />
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
            <div aria-hidden="true" className="mt-2 grid grid-cols-7 gap-2 text-center sm:gap-3">
              {activity.days.map((day) => (
                <span className="text-[0.68rem] text-muted-foreground capitalize" key={day.date}>
                  {dayFormatter.format(toDate(day.date)).replace(".", "")}
                </span>
              ))}
            </div>
            <figcaption className="sr-only">
              O gráfico compara revisões de flashcards e respostas em quizzes nos últimos sete dias.
            </figcaption>
          </figure>

          <dl className="mt-5 grid grid-cols-2 gap-3 rounded-lg bg-muted/35 p-4">
            <div>
              <dt className="text-xs text-muted-foreground">Avaliações positivas</dt>
              <dd className="mt-0.5 font-heading text-xl tabular-nums">
                {activity.flashcardRecallRate === null
                  ? "Sem dados"
                  : percentFormatter.format(activity.flashcardRecallRate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Acertos nos quizzes</dt>
              <dd className="mt-0.5 font-heading text-xl tabular-nums">
                {activity.quizAccuracyRate === null
                  ? "Sem dados"
                  : percentFormatter.format(activity.quizAccuracyRate)}
              </dd>
            </div>
          </dl>
        </div>
      )}
      <Link
        className="mt-4 w-fit rounded text-sm text-primary underline-offset-4 hover:underline focus-visible:outline-2"
        to="/statistics"
      >
        Ver estatísticas
      </Link>
    </section>
  );
};
