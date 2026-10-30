import { useState } from "react";
import { Link } from "react-router";
import { LEGAL_CONTACT } from "@lazuli/shared";
import { Button } from "@/components/ui/button.tsx";
import { createBillingPortal } from "@/features/billing/api/billing-api.ts";
import DataSectionPage from "@/features/account-settings/pages/data-section-page.tsx";
import { SettingsSurface } from "@/features/account-settings/components/settings-ui.tsx";
import { authClient } from "@/features/auth/auth-client.ts";
import { startSignOut } from "@/features/auth/sign-out.ts";

export default function AccountOptionsPage() {
  const session = authClient.useSession();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const openPortal = async () => {
    setPending(true);
    setFailed(false);
    try {
      const destination = await createBillingPortal("/account-options");
      window.location.assign(destination.url);
    } catch {
      setFailed(true);
      setPending(false);
    }
  };
  return (
    <div className="min-h-svh bg-background">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-5 py-5">
        <Link to="/" className="font-heading text-2xl font-semibold">
          Lazúli
        </Link>
        <Button
          variant="outline"
          onClick={() => startSignOut({ userId: session.data?.user.id, returnTo: "/" })}
        >
          Sair
        </Button>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-6 sm:py-10">
        <Button asChild variant="outline" className="mb-6">
          <Link to="/dashboard">Voltar aos termos</Link>
        </Button>
        <DataSectionPage />
        <SettingsSurface className="mt-4" title="Assinatura e suporte">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" disabled={pending} onClick={() => void openPortal()}>
              {pending ? "Abrindo…" : "Gerenciar assinatura"}
            </Button>
            <Button variant="outline" asChild>
              <a href={`mailto:${LEGAL_CONTACT.email}`}>Falar com suporte</a>
            </Button>
          </div>
          {failed && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              Não foi possível abrir o gerenciamento. Se não houver assinatura vinculada, entre em
              contato com o suporte.
            </p>
          )}
        </SettingsSurface>
      </main>
    </div>
  );
}
