import { accountUsageSchema } from "@lazuli/shared";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import type { ReactNode } from "react";
import { apiRequest } from "@/lib/api-client.ts";
import { formatBytes } from "@/features/billing/billing-formatters.ts";
import { Progress } from "@/components/ui/progress.tsx";
import {
  SettingsSectionHeader,
  SettingsSurface,
  SettingsLoading,
  SettingsError,
} from "../components/settings-ui.tsx";

const number = (value: number) => value.toLocaleString("pt-BR");
const date = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(value),
  );
const UsageLine = ({ label, children }: { label: ReactNode; children: ReactNode }) => (
  <div className="flex min-h-11 items-baseline justify-between gap-4 py-2 text-sm">
    <dt className="min-w-0 text-muted-foreground">{label}</dt>
    <dd className="shrink-0 text-right tabular-nums">{children}</dd>
  </div>
);

export default function UsageSectionPage() {
  const usage = useQuery({
    queryKey: ["account-settings", "usage"],
    queryFn: ({ signal }) =>
      apiRequest("/api/account-settings/usage", accountUsageSchema, { signal }),
  });
  if (usage.isPending) return <SettingsLoading />;
  if (usage.isError || !usage.data) return <SettingsError onRetry={() => void usage.refetch()} />;
  const { commercial, library, cycle } = usage.data;
  const linkClass =
    "text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground";
  return (
    <div>
      <SettingsSectionHeader title="Uso e materiais" />
      <div className="space-y-4">
        <SettingsSurface title="Sua biblioteca">
          <dl>
            <UsageLine
              label={
                <Link className={linkClass} to="/documents">
                  Projetos
                </Link>
              }
            >
              {number(library.projects)}
            </UsageLine>
            <UsageLine label="Documentos">{number(library.documents)}</UsageLine>
            <UsageLine
              label={
                <Link className={linkClass} to="/flashcards">
                  Coleções de flashcards ativas
                </Link>
              }
            >
              {number(library.flashcardCollections)}
            </UsageLine>
            <UsageLine label="Flashcards nas coleções ativas">
              {number(library.flashcards)}
            </UsageLine>
            <UsageLine
              label={
                <Link className={linkClass} to="/quizzes">
                  Quizzes ativos
                </Link>
              }
            >
              {number(library.quizzes)}
            </UsageLine>
            <UsageLine label="Questões nos quizzes ativos">{number(library.questions)}</UsageLine>
          </dl>
          {(library.archivedFlashcardCollections > 0 || library.archivedQuizzes > 0) && (
            <p className="mt-3 text-xs text-muted-foreground">
              Arquivados: {number(library.archivedFlashcardCollections)} coleções de flashcards e{" "}
              {number(library.archivedQuizzes)} quizzes.
            </p>
          )}
        </SettingsSurface>
        <SettingsSurface title="Créditos de IA">
          <p className="mb-2 text-xs text-muted-foreground">
            Ciclo de {date(cycle.startsAt)} a {date(cycle.endsAt)}.
          </p>
          <dl>
            <UsageLine label="Disponíveis">{number(commercial.credits.available)}</UsageLine>
            <UsageLine label="Consumidos neste ciclo">{number(cycle.consumed)}</UsageLine>
            <UsageLine label="Créditos mensais do plano">
              {number(commercial.credits.monthlyAllowance)}
            </UsageLine>
          </dl>
          {commercial.credits.renewsAt && (
            <p className="mt-3 text-xs text-muted-foreground">
              Próxima renovação: {date(commercial.credits.renewsAt)}. Seu saldo pode incluir bônus e
              créditos de outros ciclos.
            </p>
          )}
        </SettingsSurface>
        <SettingsSurface title="Armazenamento">
          <p className="text-sm tabular-nums">
            {formatBytes(commercial.storage.usedBytes)} de{" "}
            {formatBytes(commercial.storage.limitBytes)} usados
          </p>
          <Progress
            className="mt-3"
            value={Math.min(
              100,
              (commercial.storage.usedBytes / commercial.storage.limitBytes) * 100,
            )}
            aria-label={`${formatBytes(commercial.storage.usedBytes)} utilizados de ${formatBytes(commercial.storage.limitBytes)}`}
          />
        </SettingsSurface>
      </div>
    </div>
  );
}
