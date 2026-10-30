import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "react-router";
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from "@lazuli/shared";
import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { SessionLoading } from "@/features/auth/components/session-feedback.tsx";
import { startSignOut } from "@/features/auth/sign-out.ts";
import { ApiError } from "@/lib/api-client.ts";
import { acceptLegal, fetchLegalStatus } from "./legal-api.ts";

export const LegalGate = ({ children, userId }: { children: ReactNode; userId: string }) => {
  const client = useQueryClient();
  const { pathname } = useLocation();
  const [checked, setChecked] = useState(false);
  const key = ["legal", "status", userId];
  const status = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchLegalStatus(signal),
    staleTime: Infinity,
    retry: false,
    refetchOnMount: "always",
  });
  const mutation = useMutation({
    mutationFn: () =>
      acceptLegal({
        accepted: true,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
      }),
    onSuccess: (saved) => client.setQueryData(key, saved),
  });
  useEffect(() => {
    const invalidate = () =>
      void client.invalidateQueries({ queryKey: ["legal", "status", userId] });
    window.addEventListener("lazuli:legal-required", invalidate);
    return () => window.removeEventListener("lazuli:legal-required", invalidate);
  }, [client, userId]);

  // Rights, subscription management and deletion must never be trapped behind a contract.
  if (pathname === "/account-options") return children;
  if (status.isPending) return <SessionLoading />;
  if (status.data?.accepted && status.data.termsVersion === CURRENT_TERMS_VERSION) return children;
  const versionChanged =
    (status.data &&
      (status.data.termsVersion !== CURRENT_TERMS_VERSION ||
        status.data.privacyVersion !== CURRENT_PRIVACY_VERSION)) ||
    (mutation.error instanceof ApiError && mutation.error.code === "LEGAL_VERSION_CHANGED");

  return (
    <main className="min-h-svh bg-background">
      <div className="px-6 py-5 font-heading text-2xl font-semibold">Lazúli</div>
      <Dialog open>
        <DialogContent
          showCloseButton={false}
          className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md"
          onEscapeKeyDown={(event) => event.preventDefault()}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Termos e privacidade</DialogTitle>
            <DialogDescription>
              Para continuar, conheça as condições de uso do Lazúli e como cuidamos dos seus dados.
            </DialogDescription>
          </DialogHeader>
          {status.isError ? (
            <div role="alert" className="space-y-3 text-sm">
              <p>Não foi possível verificar seu aceite.</p>
              <Button
                variant="outline"
                disabled={status.isFetching}
                onClick={() => void status.refetch()}
              >
                Tentar novamente
              </Button>
            </div>
          ) : versionChanged ? (
            <div role="alert" className="space-y-3 text-sm">
              <p>
                Os documentos foram atualizados. Atualize a página para consultar a versão vigente.
              </p>
              <Button onClick={() => window.location.reload()}>Atualizar página</Button>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-3 text-sm leading-relaxed">
                <Checkbox
                  id="legal-acceptance"
                  className="mt-0.5"
                  checked={checked}
                  disabled={mutation.isPending}
                  onCheckedChange={(value) => setChecked(value === true)}
                />
                <label className="cursor-pointer" htmlFor="legal-acceptance">
                  Concordo com os{" "}
                  <Link
                    to="/termos"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4 hover:text-primary"
                  >
                    Termos de Uso
                  </Link>{" "}
                  e estou ciente da{" "}
                  <Link
                    to="/privacidade"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4 hover:text-primary"
                  >
                    Política de Privacidade
                  </Link>
                  .
                </label>
              </div>
              {mutation.isError && (
                <p role="alert" className="text-sm text-destructive">
                  Não foi possível salvar seu aceite. Tente novamente.
                </p>
              )}
            </>
          )}
          <DialogFooter className="sm:justify-between">
            <Button variant="ghost" asChild>
              <Link to="/account-options">Outras opções</Link>
            </Button>
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Button
                disabled={mutation.isPending}
                variant="outline"
                onClick={() => startSignOut({ userId, returnTo: "/" })}
              >
                Sair
              </Button>
              <Button
                disabled={
                  !checked || status.isError || Boolean(versionChanged) || mutation.isPending
                }
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending && <Spinner aria-hidden="true" />}Concordar e continuar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};
