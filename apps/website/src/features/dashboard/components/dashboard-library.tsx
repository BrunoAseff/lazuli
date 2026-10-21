import type { DashboardResponse } from "@lazuli/shared";
import { FileTextIcon } from "@phosphor-icons/react/FileText";
import { PlayIcon } from "@phosphor-icons/react/Play";
import { ArrowRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { DocumentDomainIcon, QuizDomainIcon } from "@/components/domain-icons.ts";
import { Badge } from "@/components/ui/badge.tsx";
import { DashboardSectionTitle } from "./dashboard-section-title.tsx";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const SectionHeading = ({
  href,
  icon,
  id,
  title,
}: {
  href?: string;
  icon: ReactNode;
  id: string;
  title: string;
}) => (
  <DashboardSectionTitle
    action={
      href ? (
        <Link
          className="inline-flex shrink-0 items-center gap-1 text-sm text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          to={href}
        >
          Ver todos
          <ArrowRightIcon aria-hidden="true" className="size-4" />
        </Link>
      ) : undefined
    }
    icon={icon}
    id={id}
    title={title}
  />
);

export const DashboardRecentDocuments = ({
  documents,
}: {
  documents: DashboardResponse["recentDocuments"];
}) => {
  if (!documents.length) return null;
  return (
    <section
      aria-labelledby="dashboard-documents-title"
      className="h-full px-3 py-5 sm:px-5 sm:py-6"
    >
      <SectionHeading
        href="/documents"
        icon={<DocumentDomainIcon aria-hidden="true" className="size-6" weight="duotone" />}
        id="dashboard-documents-title"
        title="Documentos recentes"
      />
      <div className="mt-4 space-y-1">
        {documents.map((document) => (
          <Link
            className="group flex min-w-0 items-center gap-3 rounded-lg px-3 py-3 outline-none transition-colors hover:bg-muted/45 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
            key={document.documentId}
            to={`/documents/${document.projectId}/document/${document.documentId}`}
          >
            <FileTextIcon
              aria-hidden="true"
              className="size-5 shrink-0 text-muted-foreground"
              weight="duotone"
            />
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium group-hover:underline">
                  {document.documentTitle}
                </span>
                {document.isExample && <Badge variant="secondary">Exemplo</Badge>}
              </span>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {document.projectTitle}
              </span>
            </span>
            <time
              className="hidden shrink-0 text-xs text-muted-foreground sm:block"
              dateTime={document.updatedAt}
            >
              {dateFormatter.format(new Date(document.updatedAt))}
            </time>
          </Link>
        ))}
      </div>
    </section>
  );
};

export const DashboardContinuations = ({
  quizzes,
}: {
  quizzes: DashboardResponse["quizContinuations"];
}) => {
  if (!quizzes.length) return null;
  return (
    <section
      aria-labelledby="dashboard-continuations-title"
      className="h-full px-3 py-5 sm:px-5 sm:py-6"
    >
      <SectionHeading
        icon={<QuizDomainIcon aria-hidden="true" className="size-6" weight="duotone" />}
        id="dashboard-continuations-title"
        title="Continuar"
      />
      <div className="mt-4 space-y-1">
        {quizzes.map((collection) => {
          const href =
            collection.kind === "active"
              ? `/quizzes/${collection.collectionId}/attempts/${collection.attemptId}`
              : `/quizzes/${collection.collectionId}`;
          const description =
            collection.kind === "active"
              ? `${collection.answeredQuestions} de ${collection.totalQuestions} respondidas`
              : collection.kind === "untried"
                ? `${collection.totalQuestions} questões · ainda não praticado`
                : `${collection.totalQuestions} questões · praticado recentemente`;
          return (
            <Link
              className="group flex min-w-0 items-center gap-3 rounded-lg px-3 py-3 outline-none transition-colors hover:bg-muted/45 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
              key={`${collection.kind}:${collection.collectionId}`}
              to={href}
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[color-mix(in_oklch,var(--warning),transparent_86%)] text-[var(--warning)]">
                <PlayIcon aria-hidden="true" className="size-5" weight="duotone" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium group-hover:underline">
                  {collection.collectionTitle}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
              </span>
              <ArrowRightIcon aria-hidden="true" className="size-4 shrink-0 text-primary" />
            </Link>
          );
        })}
      </div>
    </section>
  );
};
