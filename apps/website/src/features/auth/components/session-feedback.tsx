import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";

export const SessionLoading = () => (
  <main className="grid min-h-svh place-items-center bg-background" role="status">
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner aria-hidden="true" />
      Verificando sua sessão…
    </div>
  </main>
);

export const SessionError = () => (
  <main className="grid min-h-svh place-items-center bg-background px-5 text-center">
    <div className="max-w-sm space-y-4">
      <h1 className="font-heading text-3xl">Não foi possível verificar sua sessão</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        Confira sua conexão e tente novamente.
      </p>
      <Button onClick={() => window.location.reload()} type="button">
        Tentar novamente
      </Button>
    </div>
  </main>
);
