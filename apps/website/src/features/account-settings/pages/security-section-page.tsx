import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { ConfirmationDialog } from "@/components/confirmation-dialog.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { resetAnalytics } from "@/features/analytics/analytics-client.ts";
import { authClient } from "@/features/auth/auth-client.ts";
import { getAuthErrorMessage } from "@/features/auth/auth-messages.ts";
import { PasswordInput } from "@/features/auth/components/password-input.tsx";
import {
  useAccountProfile,
  useAccountSessions,
  useRevokeAccountSession,
  useRevokeOtherAccountSessions,
} from "../api/account-settings-queries.ts";
import {
  InlineFeedback,
  SettingsActionRow,
  SettingsError,
  SettingsLoading,
  SettingsSectionHeader,
  SettingsSurface,
} from "../components/settings-ui.tsx";

const describeUserAgent = (value: string | null) => {
  if (!value) return "Dispositivo desconhecido";
  const browser = value.includes("Edg/")
    ? "Edge"
    : value.includes("Chrome/")
      ? "Chrome"
      : value.includes("Firefox/")
        ? "Firefox"
        : value.includes("Safari/")
          ? "Safari"
          : "Navegador";
  const system = value.includes("Windows")
    ? "Windows"
    : value.includes("Mac OS")
      ? "macOS"
      : value.includes("Android")
        ? "Android"
        : value.includes("iPhone") || value.includes("iPad")
          ? "iOS"
          : value.includes("Linux")
            ? "Linux"
            : null;
  return system ? `${browser} em ${system}` : browser;
};

const formatActivity = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

export const SecuritySectionPage = () => {
  const profile = useAccountProfile();
  const sessions = useAccountSessions();
  const revokeSession = useRevokeAccountSession();
  const revokeOthers = useRevokeOtherAccountSessions();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordFeedback, setPasswordFeedback] = useState<{
    kind: "error" | "success";
    text: string;
  } | null>(null);
  const [passwordPending, setPasswordPending] = useState(false);
  const [pendingSession, setPendingSession] = useState<string | null>(null);
  const [unlinkGoogleOpen, setUnlinkGoogleOpen] = useState(false);
  const [methodFeedback, setMethodFeedback] = useState<string | null>(null);
  const [passwordSetupPending, setPasswordSetupPending] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);

  if (profile.isPending || sessions.isPending) return <SettingsLoading />;
  if (profile.isError || sessions.isError || !profile.data || !sessions.data)
    return (
      <SettingsError
        onRetry={() => {
          void profile.refetch();
          void sessions.refetch();
        }}
      />
    );

  const hasPassword = profile.data.methods.includes("credential");
  const hasGoogle = profile.data.methods.includes("google");
  const otherSessions = sessions.data.items.filter(({ isCurrent }) => !isCurrent);
  const visibleSessions = showAllSessions ? sessions.data.items : sessions.data.items.slice(0, 5);
  const sessionCount = `${sessions.data.items.length} ${sessions.data.items.length === 1 ? "sessão ativa" : "sessões ativas"}`;

  const closePasswordDialog = () => {
    setPasswordOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    if (passwordFeedback?.kind === "error") setPasswordFeedback(null);
  };

  const changePassword = async () => {
    setPasswordFeedback(null);
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ kind: "error", text: "As novas senhas não coincidem." });
      return;
    }
    setPasswordPending(true);
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setPasswordPending(false);
    if (error) {
      setPasswordFeedback({
        kind: "error",
        text: getAuthErrorMessage(error, "Não foi possível alterar a senha."),
      });
      return;
    }
    closePasswordDialog();
    setPasswordFeedback({
      kind: "success",
      text: "Senha alterada. As outras sessões foram encerradas.",
    });
    void sessions.refetch();
  };

  const linkGoogle = async () => {
    setMethodFeedback(null);
    const { error } = await authClient.linkSocial({
      callbackURL: `${window.location.origin}/settings/security?linked=google`,
      errorCallbackURL: `${window.location.origin}/settings/security?googleError=true`,
      provider: "google",
    });
    if (error) setMethodFeedback(getAuthErrorMessage(error, "Não foi possível vincular o Google."));
  };

  const requestPasswordSetup = async () => {
    setMethodFeedback(null);
    setPasswordSetupPending(true);
    const { error } = await authClient.requestPasswordReset({
      email: profile.data!.email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setPasswordSetupPending(false);
    if (error) {
      setMethodFeedback(
        getAuthErrorMessage(error, "Não foi possível enviar o link para criar uma senha."),
      );
      return;
    }
    setPasswordFeedback({ kind: "success", text: "Enviamos um link para você criar uma senha." });
  };

  const unlinkGoogle = async () => {
    const { error } = await authClient.unlinkAccount({ providerId: "google" });
    if (error) {
      setMethodFeedback(
        getAuthErrorMessage(error, "Não foi possível desvincular esta forma de acesso."),
      );
      return;
    }
    setUnlinkGoogleOpen(false);
    await profile.refetch();
  };

  const signOutCurrent = async () => {
    const { error } = await authClient.signOut();
    if (error) return;
    resetAnalytics();
    queryClient.clear();
    await navigate("/login", { replace: true });
  };

  const confirmSessionRevocation = async () => {
    if (pendingSession === "others") await revokeOthers.mutateAsync();
    else if (pendingSession) await revokeSession.mutateAsync(pendingSession);
    setPendingSession(null);
  };

  const methodMessage = methodFeedback
    ? { kind: "error" as const, text: methodFeedback }
    : searchParams.get("googleError")
      ? { kind: "error" as const, text: "Não foi possível concluir o vínculo com o Google." }
      : searchParams.get("linked") === "google"
        ? { kind: "success" as const, text: "Google vinculado à sua conta." }
        : passwordFeedback?.kind === "success"
          ? passwordFeedback
          : null;

  return (
    <div>
      <SettingsSectionHeader title="Acesso e segurança" />

      {methodMessage && (
        <div className="mb-5">
          <InlineFeedback kind={methodMessage.kind}>{methodMessage.text}</InlineFeedback>
        </div>
      )}

      <SettingsSurface title="Formas de acesso">
        <SettingsActionRow
          action={
            hasPassword ? (
              <Button onClick={() => setPasswordOpen(true)} variant="outline">
                Alterar senha
              </Button>
            ) : (
              <Button
                disabled={passwordSetupPending}
                onClick={() => void requestPasswordSetup()}
                variant="outline"
              >
                {passwordSetupPending && <Spinner aria-hidden="true" />}
                Criar senha
              </Button>
            )
          }
          description={hasPassword ? undefined : "Não cadastrada"}
          label="Senha"
        />

        {profile.data.googleEnabled && (
          <SettingsActionRow
            action={
              hasGoogle ? (
                <Button
                  disabled={!hasPassword}
                  onClick={() => setUnlinkGoogleOpen(true)}
                  title={hasPassword ? undefined : "Crie uma senha antes de desvincular o Google"}
                  variant="outline"
                >
                  Desvincular
                </Button>
              ) : (
                <Button onClick={() => void linkGoogle()} variant="outline">
                  Vincular
                </Button>
              )
            }
            description={
              <Badge className="font-normal" variant="outline">
                {hasGoogle ? "Vinculado" : "Não vinculado"}
              </Badge>
            }
            label="Google"
          />
        )}
      </SettingsSurface>

      <SettingsSurface
        action={
          otherSessions.length > 0 ? (
            <Button onClick={() => setPendingSession("others")} variant="outline">
              Encerrar outras
            </Button>
          ) : null
        }
        className="mt-4"
        meta={sessionCount}
        title="Sessões"
      >
        <div className="grid gap-1 rounded-[var(--radius)] bg-background/80 p-1">
          {visibleSessions.map((item) => (
            <div
              className="grid gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-center"
              key={item.id}
            >
              <div className="min-w-0">
                <p className="text-sm">{describeUserAgent(item.userAgent)}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.isCurrent
                    ? "Este dispositivo"
                    : `Atividade em ${formatActivity(item.updatedAt)}`}
                  {item.isCurrent && ` · atividade em ${formatActivity(item.updatedAt)}`}
                </p>
              </div>
              <Button
                className="justify-self-start rounded-md sm:justify-self-end"
                onClick={() =>
                  item.isCurrent ? void signOutCurrent() : setPendingSession(item.id)
                }
                variant="destructive"
              >
                {item.isCurrent ? "Sair deste dispositivo" : "Encerrar sessão"}
              </Button>
            </div>
          ))}
        </div>
        {sessions.data.items.length > 5 && (
          <div className="mt-3">
            <Button onClick={() => setShowAllSessions((value) => !value)} variant="outline">
              {showAllSessions ? "Mostrar menos" : `Mostrar mais ${sessions.data.items.length - 5}`}
            </Button>
          </div>
        )}
      </SettingsSurface>

      <Dialog
        open={passwordOpen}
        onOpenChange={(open) => {
          if (!open) closePasswordDialog();
          else setPasswordOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar senha</DialogTitle>
            <DialogDescription className="sr-only">
              Informe sua senha atual e escolha uma nova senha.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            id="change-password-form"
            onSubmit={(event) => {
              event.preventDefault();
              void changePassword();
            }}
          >
            <label className="grid gap-1.5 text-sm" htmlFor="current-password">
              Senha atual
              <PasswordInput
                autoComplete="current-password"
                id="current-password"
                onChange={(event) => setCurrentPassword(event.target.value)}
                value={currentPassword}
              />
            </label>
            <label className="grid gap-1.5 text-sm" htmlFor="new-password">
              Nova senha
              <PasswordInput
                autoComplete="new-password"
                id="new-password"
                minLength={8}
                onChange={(event) => setNewPassword(event.target.value)}
                value={newPassword}
              />
            </label>
            <label className="grid gap-1.5 text-sm" htmlFor="confirm-new-password">
              Confirmar nova senha
              <PasswordInput
                autoComplete="new-password"
                id="confirm-new-password"
                onChange={(event) => setConfirmPassword(event.target.value)}
                value={confirmPassword}
              />
            </label>
            {passwordFeedback?.kind === "error" && (
              <InlineFeedback kind="error">{passwordFeedback.text}</InlineFeedback>
            )}
          </form>
          <DialogFooter>
            <DialogCancelButton disabled={passwordPending} onClick={closePasswordDialog}>
              Cancelar
            </DialogCancelButton>
            <Button
              disabled={
                passwordPending || !currentPassword || newPassword.length < 8 || !confirmPassword
              }
              form="change-password-form"
              type="submit"
            >
              {passwordPending && <Spinner aria-hidden="true" />}
              Salvar nova senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmationDialog
        actionLabel={
          revokeSession.isPending || revokeOthers.isPending ? (
            <>
              <Spinner aria-hidden="true" /> Encerrando…
            </>
          ) : (
            "Encerrar"
          )
        }
        description={
          pendingSession === "others"
            ? "Todos os outros dispositivos precisarão entrar novamente. Esta sessão continuará ativa."
            : "Este dispositivo perderá o acesso à sua conta e precisará entrar novamente."
        }
        destructive
        disabled={revokeSession.isPending || revokeOthers.isPending}
        onConfirm={confirmSessionRevocation}
        onOpenChange={(open) => !open && setPendingSession(null)}
        open={Boolean(pendingSession)}
        title={pendingSession === "others" ? "Encerrar outras sessões" : "Encerrar esta sessão"}
      />

      <ConfirmationDialog
        actionLabel="Desvincular Google"
        description="Você continuará acessando a conta com sua senha. O Google deixará de ser uma forma de entrada."
        onConfirm={unlinkGoogle}
        onOpenChange={setUnlinkGoogleOpen}
        open={unlinkGoogleOpen}
        title="Desvincular Google"
      />
    </div>
  );
};

export default SecuritySectionPage;
