import { Link } from "react-router";

import { EmptyState } from "@/components/empty-state.tsx";
import { SearchXIcon, TriangleAlertIcon } from "@/components/icons.tsx";
import { Button } from "@/components/ui/button.tsx";
import { ApiError } from "@/lib/api-client.ts";

/** Whether a failed request means the thing is gone (as opposed to a connection or server failure). */
export const isNotFound = (error: unknown) =>
  error instanceof ApiError && (error.status === 404 || error.status === 403);

/**
 * One answer for "this cannot be shown": gone (with the way back) or not loaded this time
 * (with a retry). A dropped connection never reads as "deleted".
 */
export const ResourceUnavailable = ({
  backLabel,
  backTo,
  description,
  notFound,
  onRetry,
  title,
}: {
  backLabel: string;
  backTo: string;
  description?: string;
  notFound: boolean;
  onRetry?: () => void;
  /** What was not found, e.g. "Coleção não encontrada". */
  title: string;
}) => (
  <main className="mx-auto grid w-full max-w-xl flex-1 place-items-center px-5 py-12">
    <EmptyState
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild variant={notFound || !onRetry ? "default" : "outline"}>
            <Link to={backTo}>{backLabel}</Link>
          </Button>
          {!notFound && onRetry && <Button onClick={onRetry}>Tentar novamente</Button>}
        </div>
      }
      description={
        notFound
          ? (description ?? "Pode ter sido excluído ou não pertencer à sua biblioteca.")
          : "Confira sua conexão e tente novamente."
      }
      icon={notFound ? SearchXIcon : TriangleAlertIcon}
      // The whole page is the message: no card around it.
      surface="inline"
      title={notFound ? title : "Não foi possível carregar"}
    />
  </main>
);

/** An address that leads nowhere says so, inside the app, with the way back at hand. */
export const NotFoundPage = () => (
  <ResourceUnavailable
    backLabel="Voltar ao início"
    backTo="/dashboard"
    description="O endereço não existe ou o conteúdo foi removido. Use a busca (Ctrl K) para encontrar o que procura."
    notFound
    title="Página não encontrada"
  />
);
