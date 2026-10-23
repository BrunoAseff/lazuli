import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { finishSignOut, readPendingSignOut } from "@/features/auth/sign-out.ts";

export const SessionLoading = () => (
  <main className="grid min-h-svh place-items-center bg-background" role="status">
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner aria-hidden="true" />
      Verificando sua sessão…
    </div>
  </main>
);

export const SessionEnding = () => {
  const [pending] = useState(readPendingSignOut);
  const [failed, setFailed] = useState(false);
  const running = useRef(false);

  const finish = useCallback(async () => {
    if (running.current) return;
    if (!pending) {
      window.location.replace("/");
      return;
    }

    running.current = true;
    setFailed(false);
    const { error } = await finishSignOut(pending);
    if (error) {
      running.current = false;
      setFailed(true);
      return;
    }

    window.location.replace("/login");
  }, [pending]);

  useEffect(() => {
    void finish();
  }, [finish]);

  if (failed)
    return (
      <main className="grid min-h-svh place-items-center bg-background px-5 text-center">
        <div className="max-w-sm space-y-4">
          <h1 className="font-heading text-3xl">Não foi possível sair</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Sua sessão continua ativa. Verifique sua conexão e tente novamente.
          </p>
          <div className="flex justify-center gap-2">
            <Button
              onClick={() => window.location.replace(pending?.returnTo ?? "/")}
              variant="outline"
            >
              Voltar
            </Button>
            <Button onClick={() => void finish()}>Tentar novamente</Button>
          </div>
        </div>
      </main>
    );

  return (
    <main className="grid min-h-svh place-items-center bg-background" role="status">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner aria-hidden="true" />
        Encerrando sua sessão…
      </div>
    </main>
  );
};

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
