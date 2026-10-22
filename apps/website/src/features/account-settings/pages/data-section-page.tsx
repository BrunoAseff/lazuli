import type { AccountExportCategory } from "@lazuli/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";

import { Button } from "@/components/ui/button.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { resetAnalytics } from "@/features/analytics/analytics-client.ts";
import {
  useAnalyticsPreference,
  useUpdateAnalyticsPreference,
} from "@/features/analytics/api/analytics-queries.ts";
import { authClient } from "@/features/auth/auth-client.ts";
import { getApiErrorMessage } from "@/lib/api-client.ts";
import {
  useAccountProfile,
  useDeleteAccount,
  useRequestAccountExport,
} from "../api/account-settings-queries.ts";
import {
  InlineFeedback,
  SettingsError,
  SettingsLoading,
  SettingsPreferenceRow,
  SettingsSectionHeader,
  SettingsSurface,
} from "../components/settings-ui.tsx";

const exportCategories: ReadonlyArray<{
  description: string;
  label: string;
  value: AccountExportCategory;
}> = [
  {
    description: "Perfil, preferências, sessões e assinatura",
    label: "Conta",
    value: "account",
  },
  {
    description: "Projetos, documentos e arquivos enviados",
    label: "Projetos e documentos",
    value: "projects",
  },
  {
    description: "Coleções, cartões e histórico de revisões",
    label: "Flashcards",
    value: "flashcards",
  },
  {
    description: "Coleções, questões, tentativas e respostas",
    label: "Quizzes",
    value: "quizzes",
  },
  {
    description: "Referências e vínculos entre materiais",
    label: "Referências",
    value: "references",
  },
] as const;

const allExportCategories = exportCategories.map(({ value }) => value);

export const DataSectionPage = () => {
  const session = authClient.useSession();
  const profile = useAccountProfile();
  const requestExport = useRequestAccountExport();
  const deleteAccount = useDeleteAccount();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const userId = session.data?.user.id ?? "";
  const analytics = useAnalyticsPreference(userId);
  const updateAnalytics = useUpdateAnalyticsPreference(userId);
  const [analyticsInfoOpen, setAnalyticsInfoOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [categories, setCategories] = useState<AccountExportCategory[]>(allExportCategories);
  const [exportFeedback, setExportFeedback] = useState<{
    kind: "error" | "neutral" | "success";
    text: string;
  } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [password, setPassword] = useState("");
  if (session.isPending || profile.isPending || analytics.isPending) return <SettingsLoading />;
  if (session.error || profile.isError || analytics.isError || !profile.data || !session.data)
    return (
      <SettingsError
        onRetry={() => {
          void profile.refetch();
          void analytics.refetch();
          void session.refetch();
        }}
      />
    );

  const hasPassword = profile.data.methods.includes("credential");

  const toggleCategory = (category: AccountExportCategory, checked: boolean) => {
    setCategories((current) =>
      checked ? [...new Set([...current, category])] : current.filter((item) => item !== category),
    );
    requestExport.reset();
  };

  const createExport = async () => {
    setExportFeedback(null);
    try {
      await requestExport.mutateAsync({ categories });
      setExportOpen(false);
      setCategories(allExportCategories);
      setExportFeedback({
        kind: "success",
        text: "Solicitação recebida. Enviaremos a cópia como anexo para o seu e-mail.",
      });
    } catch (error) {
      setExportFeedback({
        kind: "error",
        text: getApiErrorMessage(error, "Não foi possível solicitar sua cópia.", {
          EXPORT_ALREADY_RUNNING:
            "Sua cópia já está sendo preparada e será enviada para o seu e-mail.",
        }),
      });
    }
  };

  const removeAccount = async () => {
    try {
      await deleteAccount.mutateAsync({
        confirmationEmail: confirmationEmail.trim().toLowerCase(),
        ...(hasPassword ? { password } : {}),
      });
      resetAnalytics();
      queryClient.clear();
      await navigate("/login", { replace: true });
    } catch {
      // The mutation error remains visible inside the confirmation dialog.
    }
  };

  const closeDeleteDialog = () => {
    if (deleteAccount.isPending) return;
    setDeleteOpen(false);
    setConfirmationEmail("");
    setPassword("");
    deleteAccount.reset();
  };

  const exactEmail = confirmationEmail.trim().toLowerCase() === profile.data.email.toLowerCase();
  const canDelete = exactEmail && (!hasPassword || password.length > 0);

  return (
    <div>
      <SettingsSectionHeader title="Dados e privacidade" />

      <SettingsSurface
        action={
          <Switch
            aria-label="Permitir métricas de uso"
            checked={analytics.data?.status === "granted"}
            disabled={updateAnalytics.isPending}
            id="settings-analytics"
            onCheckedChange={(checked) =>
              updateAnalytics.mutate({ status: checked ? "granted" : "denied" })
            }
          />
        }
        title="Métricas de uso"
      >
        <p className="text-sm text-muted-foreground">
          Ajude a melhorar o Lazúli sem compartilhar dados pessoais ou materiais.{" "}
          <Button
            className="h-auto p-0 align-baseline text-sm"
            onClick={() => setAnalyticsInfoOpen(true)}
            variant="link"
          >
            Saiba como funciona
          </Button>
        </p>
        {updateAnalytics.isError && (
          <div className="mt-2">
            <InlineFeedback kind="error">Não foi possível salvar esta preferência.</InlineFeedback>
          </div>
        )}
      </SettingsSurface>

      <SettingsSurface className="mt-4" title="Cópia dos seus dados">
        <SettingsPreferenceRow
          action={
            <Button onClick={() => setExportOpen(true)} variant="outline">
              Solicitar cópia
            </Button>
          }
          align="end"
        >
          <p className="text-sm text-muted-foreground">
            Enviaremos a cópia como anexo para o seu e-mail.
          </p>
        </SettingsPreferenceRow>
        {exportFeedback && (
          <div className="mt-3">
            <InlineFeedback kind={exportFeedback.kind}>{exportFeedback.text}</InlineFeedback>
          </div>
        )}
      </SettingsSurface>

      <SettingsSurface className="mt-4 bg-destructive/[0.045]" title="Excluir conta">
        <SettingsPreferenceRow
          action={
            <Button onClick={() => setDeleteOpen(true)} variant="destructive">
              Excluir conta
            </Button>
          }
          align="end"
        >
          <p className="text-sm text-muted-foreground">
            Remove permanentemente sua conta, seus materiais e seu histórico.
          </p>
        </SettingsPreferenceRow>
      </SettingsSurface>

      <Dialog open={analyticsInfoOpen} onOpenChange={setAnalyticsInfoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Como as métricas funcionam</DialogTitle>
            <DialogDescription className="sr-only">
              Informações sobre os dados coletados pelo Lazúli.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Registramos ações gerais, como abrir uma área ou concluir uma prática, para entender
              quais partes do produto precisam melhorar.
            </p>
            <p>
              Essas métricas usam um identificador pseudônimo da conta e informações técnicas do
              dispositivo. Nome, e-mail e conteúdo dos seus materiais não são enviados.
            </p>
          </div>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      <Dialog
        open={exportOpen}
        onOpenChange={(open) => {
          if (requestExport.isPending) return;
          setExportOpen(open);
          if (open) {
            setCategories(allExportCategories);
            requestExport.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Solicitar cópia dos seus dados</DialogTitle>
            <DialogDescription className="sr-only">
              Escolha quais dados deseja incluir na cópia enviada por e-mail.
            </DialogDescription>
          </DialogHeader>
          <div>
            <p className="mb-3 text-sm text-muted-foreground">
              Selecione o conteúdo que deseja incluir.
            </p>
            <div className="grid gap-1">
              {exportCategories.map(({ description, label, value }) => (
                <label
                  className="flex cursor-pointer items-start gap-3 rounded-[var(--radius)] px-3 py-3 transition-colors hover:bg-muted/55"
                  htmlFor={`export-${value}`}
                  key={value}
                >
                  <Checkbox
                    checked={categories.includes(value)}
                    className="mt-0.5"
                    id={`export-${value}`}
                    onCheckedChange={(checked) => toggleCategory(value, checked === true)}
                  />
                  <span>
                    <span className="block text-sm text-foreground">{label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {requestExport.isError && exportFeedback && (
              <div className="mt-3">
                <InlineFeedback kind="error">{exportFeedback.text}</InlineFeedback>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button disabled={requestExport.isPending} variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button
              disabled={categories.length === 0 || requestExport.isPending}
              onClick={() => void createExport()}
            >
              {requestExport.isPending && <Spinner aria-hidden="true" />}
              Solicitar cópia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (open) setDeleteOpen(true);
          else closeDeleteDialog();
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Excluir sua conta?</DialogTitle>
            <DialogDescription className="sr-only">
              Confirme a exclusão permanente da sua conta e dos seus dados.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              A exclusão cancela sua assinatura e remove permanentemente seus materiais e seu
              histórico. Digite{" "}
              <strong className="font-medium text-foreground">{profile.data.email}</strong> para
              confirmar.
            </p>
            <label className="grid gap-1.5 text-sm" htmlFor="delete-email">
              E-mail da conta
              <Input
                autoComplete="off"
                id="delete-email"
                onChange={(event) => setConfirmationEmail(event.target.value)}
                value={confirmationEmail}
              />
            </label>
            {hasPassword && (
              <label className="grid gap-1.5 text-sm" htmlFor="delete-password">
                Senha atual
                <Input
                  autoComplete="current-password"
                  id="delete-password"
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  value={password}
                />
              </label>
            )}
            {deleteAccount.isError && (
              <InlineFeedback kind="error">
                {getApiErrorMessage(
                  deleteAccount.error,
                  "Não foi possível excluir a conta. Entre novamente e tente outra vez.",
                  {
                    ACCOUNT_CONFIRMATION_MISMATCH: "O e-mail digitado não corresponde à sua conta.",
                    ACCOUNT_REAUTHENTICATION_FAILED: "A senha informada está incorreta.",
                    FRESH_SESSION_REQUIRED:
                      "Por segurança, entre novamente com o Google antes de excluir a conta.",
                  },
                )}
              </InlineFeedback>
            )}
          </div>
          <DialogFooter>
            <Button
              disabled={deleteAccount.isPending}
              onClick={closeDeleteDialog}
              variant="outline"
            >
              Cancelar
            </Button>
            <Button
              disabled={!canDelete || deleteAccount.isPending}
              onClick={() => void removeAccount()}
              variant="destructive"
            >
              {deleteAccount.isPending && <Spinner aria-hidden="true" />}
              Excluir minha conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DataSectionPage;
