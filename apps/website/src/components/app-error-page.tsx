import { AlertTriangleIcon } from "lucide-react";
import { isRouteErrorResponse, Link, useRouteError } from "react-router";

import { Button } from "@/components/ui/button.tsx";

export const AppErrorPage = () => {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <div className="max-w-md border border-dashed p-8 text-center">
        <AlertTriangleIcon
          aria-hidden="true"
          className="mx-auto mb-4 size-7 text-muted-foreground"
        />
        <h1 className="font-heading text-3xl font-medium">
          {notFound ? "Página não encontrada" : "Algo deu errado"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {notFound
            ? "O endereço acessado não existe ou não está mais disponível."
            : "Não foi possível exibir esta tela. Recarregue a página para tentar novamente."}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          {!notFound && <Button onClick={() => window.location.reload()}>Recarregar</Button>}
          <Button asChild variant="outline">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </div>
      </div>
    </main>
  );
};
