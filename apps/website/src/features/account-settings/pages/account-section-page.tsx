import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { useBilling } from "@/features/billing/billing-context.tsx";
import { useBillingSummary } from "@/features/billing/api/billing-queries.ts";
import { authClient } from "@/features/auth/auth-client.ts";
import { getAuthErrorMessage } from "@/features/auth/auth-messages.ts";
import { useAccountProfile, useUpdateAccountName } from "../api/account-settings-queries.ts";
import {
  InlineFeedback,
  SettingsError,
  SettingsField,
  SettingsLoading,
  SettingsSectionHeader,
  SettingsSurface,
} from "../components/settings-ui.tsx";

const planLabel = (plan?: string) =>
  plan === "specialist" ? "Especialista" : plan === "essential" ? "Essencial" : "Básico";

export const AccountSectionPage = () => {
  const profile = useAccountProfile();
  const billing = useBillingSummary();
  const { openPlans } = useBilling();
  const updateName = useUpdateAccountName();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailPending, setEmailPending] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!profile.data) return;
    setName(profile.data.name);
    setEmail(profile.data.email);
  }, [profile.data]);

  if (profile.isPending) return <SettingsLoading />;
  if (profile.isError || !profile.data)
    return <SettingsError onRetry={() => void profile.refetch()} />;

  const normalizedName = name.trim().replaceAll(/\s+/g, " ");
  const normalizedEmail = email.trim().toLowerCase();
  const nameChanged = normalizedName !== profile.data.name;
  const emailChanged = normalizedEmail !== profile.data.email.toLowerCase();
  const nameValid = normalizedName.length >= 2 && normalizedName.length <= 80;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);

  const saveName = async () => {
    if (!nameChanged || !nameValid) return;
    try {
      await updateName.mutateAsync(normalizedName);
    } catch {
      // The mutation state renders the contextual error below.
    }
  };

  const requestEmailChange = async () => {
    if (!emailChanged || !emailValid) return;
    setEmailFeedback(null);
    setEmailPending(true);
    const { error } = await authClient.changeEmail({
      callbackURL: `${window.location.origin}/settings/account?emailChanged=true`,
      newEmail: normalizedEmail,
    });
    setEmailPending(false);
    if (error) {
      setEmailFeedback({
        kind: "error",
        text: getAuthErrorMessage(
          error,
          "Não foi possível solicitar a alteração. Entre novamente se sua sessão não for recente.",
        ),
      });
      return;
    }
    setEmailFeedback({
      kind: "success",
      text: "Enviamos a confirmação. Seu e-mail atual continua ativo até a verificação.",
    });
    setEmail(profile.data.email);
  };

  return (
    <div>
      <SettingsSectionHeader title="Conta" />

      <SettingsSurface title="Informações da conta">
        <SettingsField
          action={
            nameChanged ? (
              <>
                <Button
                  disabled={!nameValid || updateName.isPending}
                  onClick={() => void saveName()}
                >
                  {updateName.isPending && <Spinner aria-hidden="true" />}
                  Salvar
                </Button>
                <Button
                  disabled={updateName.isPending}
                  onClick={() => setName(profile.data.name)}
                  variant="ghost"
                >
                  Cancelar
                </Button>
              </>
            ) : null
          }
          label="Nome"
          message={
            updateName.isError ? (
              <InlineFeedback kind="error">
                Não foi possível salvar o nome. Revise o valor e tente novamente.
              </InlineFeedback>
            ) : undefined
          }
        >
          <Input
            aria-invalid={nameChanged && !nameValid}
            autoComplete="name"
            id="account-name"
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setName(profile.data.name);
              if (event.key === "Enter") void saveName();
            }}
            value={name}
          />
        </SettingsField>

        <SettingsField
          action={
            emailChanged ? (
              <>
                <Button
                  disabled={!emailValid || emailPending}
                  onClick={() => void requestEmailChange()}
                >
                  {emailPending && <Spinner aria-hidden="true" />}
                  Salvar
                </Button>
                <Button
                  disabled={emailPending}
                  onClick={() => {
                    setEmail(profile.data.email);
                    setEmailFeedback(null);
                  }}
                  variant="ghost"
                >
                  Cancelar
                </Button>
              </>
            ) : null
          }
          label="E-mail"
          message={
            emailFeedback ? (
              <InlineFeedback kind={emailFeedback.kind}>{emailFeedback.text}</InlineFeedback>
            ) : emailChanged ? (
              "O endereço atual permanece ativo até o novo ser confirmado."
            ) : undefined
          }
        >
          <Input
            aria-invalid={emailChanged && !emailValid}
            autoComplete="email"
            id="account-email"
            onChange={(event) => {
              setEmail(event.target.value);
              setEmailFeedback(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setEmail(profile.data.email);
              if (event.key === "Enter") void requestEmailChange();
            }}
            type="email"
            value={email}
          />
        </SettingsField>

        <SettingsField
          action={
            <Button onClick={openPlans} variant="outline">
              Gerenciar assinatura
            </Button>
          }
          label="Plano"
        >
          <div className="flex h-9 items-center">
            <Badge className="font-normal" variant="outline">
              {billing.isPending ? "Carregando…" : planLabel(billing.data?.plan)}
            </Badge>
          </div>
        </SettingsField>
      </SettingsSurface>
    </div>
  );
};

export default AccountSectionPage;
