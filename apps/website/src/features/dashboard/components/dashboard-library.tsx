import { formatRecent } from "@/lib/date-format.ts";
import type { DashboardResponse } from "@lazuli/shared";
import { useState, type ReactNode, type Ref } from "react";
import { Link } from "react-router";

import { DocumentDomainIcon, QuizDomainIcon } from "@/components/domain-icons.ts";
import type { AppIcon } from "@/components/icons.tsx";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import { QuizStartDialog } from "@/features/quizzes/components/quiz-start-dialog.tsx";

type Item = {
  key: string;
  icon: AppIcon;
  title: string;
  detail: string;
  /** Right column: when it was last touched, or that it is under way. */
  when: string | null;
  inProgress: boolean;
  href?: string;
  onSelect?: () => void;
};

const questionCount = (count: number) => `${count} ${count === 1 ? "questão" : "questões"}`;

const timeOf = (item: Item) => (item.when ? new Date(item.when).getTime() : 0);

/**
 * Everything to pick up again, quizzes and documents in one list: what is under way first, then
 * the most recent. Rows sit on white, so hover never fills: the name underlines.
 */
export const DashboardContinue = ({
  documents,
  quizzes,
}: {
  documents: DashboardResponse["recentDocuments"];
  quizzes: DashboardResponse["quizContinuations"];
}) => {
  // A quiz not yet under way starts from a dialog here; the editor would show its answers.
  const [starting, setStarting] = useState<string | null>(null);
  const items: Item[] = [
    ...quizzes.map(
      (quiz): Item => ({
        key: `quiz:${quiz.collectionId}`,
        icon: QuizDomainIcon,
        title: quiz.collectionTitle,
        detail:
          quiz.kind === "active"
            ? `Quiz · ${quiz.answeredQuestions} de ${quiz.totalQuestions} respondidas`
            : quiz.kind === "untried"
              ? `Quiz · ${questionCount(quiz.totalQuestions)} · ainda não praticado`
              : `Quiz · ${questionCount(quiz.totalQuestions)}`,
        when: quiz.kind === "active" ? null : quiz.lastAttemptAt,
        inProgress: quiz.kind === "active",
        href:
          quiz.kind === "active"
            ? `/quizzes/${quiz.collectionId}/attempts/${quiz.attemptId}`
            : undefined,
        onSelect: quiz.kind === "active" ? undefined : () => setStarting(quiz.collectionId),
      }),
    ),
    ...documents.map(
      (document): Item => ({
        key: `document:${document.documentId}`,
        icon: DocumentDomainIcon,
        title: document.documentTitle,
        detail: `Documento · ${document.projectTitle}`,
        when: document.updatedAt,
        inProgress: false,
        href: `/documents/${document.projectId}/document/${document.documentId}`,
      }),
    ),
  ]
    .sort((a, b) => Number(b.inProgress) - Number(a.inProgress) || timeOf(b) - timeOf(a))
    .slice(0, 5);
  if (!items.length) return null;
  return (
    <section aria-labelledby="dashboard-continue-title" className="surface-panel p-6">
      <h2 className="text-sm leading-snug font-semibold" id="dashboard-continue-title">
        Continuar de onde parou
      </h2>
      <ul className="mt-2 grid">
        {items.map((item) => (
          <li key={item.key}>
            <ContinueRow item={item} />
          </li>
        ))}
      </ul>
      {starting && (
        <QuizStartDialog
          collectionId={starting}
          open
          onOpenChange={(open) => !open && setStarting(null)}
        />
      )}
    </section>
  );
};

const rowClass =
  "group -mx-2 flex w-[calc(100%+1rem)] min-w-0 items-center gap-3 rounded-[var(--radius)] px-2 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

const ContinueRow = ({ item }: { item: Item }) => {
  const Icon = item.icon;
  const content = (titleRef: Ref<HTMLSpanElement>): ReactNode => (
    <>
      <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-[0.9375rem] font-medium underline-offset-4 group-hover:underline"
          ref={titleRef}
        >
          {item.title}
        </span>
        {/* One details line for every kind: what it is, where it stands, when it was last touched. */}
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {[item.detail, item.inProgress ? "em andamento" : item.when && formatRecent(item.when)]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
    </>
  );
  return (
    <OverflowTooltip text={item.title}>
      {(ref) =>
        item.href ? (
          <Link className={rowClass} to={item.href}>
            {content(ref as Ref<HTMLSpanElement>)}
          </Link>
        ) : (
          <button className={rowClass} onClick={item.onSelect} type="button">
            {content(ref as Ref<HTMLSpanElement>)}
          </button>
        )
      }
    </OverflowTooltip>
  );
};
