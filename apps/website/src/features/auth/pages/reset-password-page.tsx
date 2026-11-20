import { BackLink } from "@/components/nav-link.tsx";
import { useState } from "react";
import { LockKeyOpenIcon } from "@/components/icons.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router";

import { Spinner } from "@/components/ui/spinner.tsx";
import { authClient } from "@/features/auth/auth-client.ts";
import { getAuthErrorMessage } from "@/features/auth/auth-messages.ts";
import { resetPasswordSchema, type ResetPasswordValues } from "@/features/auth/auth-schemas.ts";
import { AuthFormHeader } from "@/features/auth/components/auth-form-header.tsx";
import { AuthFeedback } from "@/features/auth/components/auth-feedback.tsx";
import { AuthPasswordField } from "@/features/auth/components/auth-form-field.tsx";
import { AuthLayout } from "@/features/auth/components/auth-layout.tsx";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button.tsx";

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const linkError = searchParams.get("error");
  const [formError, setFormError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const form = useForm<ResetPasswordValues>({
    defaultValues: { confirmPassword: "", password: "" },
    mode: "onChange",
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = form.handleSubmit(async ({ password }) => {
    if (!token) return;
    setFormError(null);

    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (error) {
      setFormError(
        getAuthErrorMessage(
          error,
          "Este link não é mais válido. Solicite uma nova redefinição de senha.",
        ),
      );
      return;
    }

    setComplete(true);
  });

  const invalidLink = Boolean(linkError || !token);

  return (
    <AuthLayout>
      {/* A plain glyph, like the empty states: no tile around it. */}
      <div className="mb-4 text-muted-foreground">
        <LockKeyOpenIcon aria-hidden="true" className="size-6" />
      </div>

      {complete ? (
        <>
          <AuthFormHeader
            description="Sua senha foi alterada e as sessões anteriores foram encerradas."
            title="Senha redefinida"
          />
          <AuthSubmitButton asChild>
            <Link to="/login?passwordReset=true">Entrar com a nova senha</Link>
          </AuthSubmitButton>
        </>
      ) : invalidLink ? (
        <>
          <AuthFormHeader
            description="Este link é inválido, expirou ou já foi utilizado."
            title="Link indisponível"
          />
          <AuthSubmitButton asChild>
            <Link to="/forgot-password">Solicitar novo link</Link>
          </AuthSubmitButton>
          <BackLink className="mt-5" to="/login">
            Voltar para entrar
          </BackLink>
        </>
      ) : (
        <>
          <AuthFormHeader
            description="Escolha uma nova senha para voltar a acessar sua conta."
            title="Defina uma nova senha"
          />
          <form className="grid gap-4" noValidate onSubmit={onSubmit}>
            <AuthPasswordField
              autoComplete="new-password"
              error={form.formState.errors.password?.message}
              id="password"
              label="Nova senha"
              {...form.register("password")}
            />
            <AuthPasswordField
              autoComplete="new-password"
              error={form.formState.errors.confirmPassword?.message}
              id="confirm-password"
              label="Confirmar nova senha"
              {...form.register("confirmPassword")}
            />

            {formError && <AuthFeedback kind="error">{formError}</AuthFeedback>}

            <AuthSubmitButton
              disabled={!form.formState.isValid || form.formState.isSubmitting}
              type="submit"
            >
              {form.formState.isSubmitting && <Spinner aria-hidden="true" />}
              {form.formState.isSubmitting ? "Salvando…" : "Redefinir senha"}
            </AuthSubmitButton>
          </form>
        </>
      )}
    </AuthLayout>
  );
};

export default ResetPasswordPage;
