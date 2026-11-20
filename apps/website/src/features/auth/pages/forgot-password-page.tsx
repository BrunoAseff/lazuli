import { BackLink } from "@/components/nav-link.tsx";
import { useEffect, useState } from "react";
import { PASSWORD_RESET_EMAIL_COOLDOWN_SECONDS } from "@lazuli/shared";
import { EnvelopeSimpleIcon } from "@/components/icons.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { authClient } from "@/features/auth/auth-client.ts";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/features/auth/auth-schemas.ts";
import { AuthFormHeader } from "@/features/auth/components/auth-form-header.tsx";
import { AuthFeedback } from "@/features/auth/components/auth-feedback.tsx";
import { AuthEmailField } from "@/features/auth/components/auth-form-field.tsx";
import { AuthLayout } from "@/features/auth/components/auth-layout.tsx";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button.tsx";
import { getAuthErrorMessage } from "@/features/auth/auth-messages.ts";

const NEUTRAL_FEEDBACK =
  "Se houver uma conta com este e-mail, enviaremos um link para redefinir a senha.";

export const ForgotPasswordPage = () => {
  const [cooldown, setCooldown] = useState(0);
  const [feedback, setFeedback] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const form = useForm<ForgotPasswordValues>({
    defaultValues: { email: "" },
    mode: "onChange",
    resolver: zodResolver(forgotPasswordSchema),
  });

  useEffect(() => {
    if (cooldown === 0) return;
    const timer = window.setTimeout(() => setCooldown((current) => current - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setFeedback(false);
    setErrorMessage("");
    const { error } = await authClient.requestPasswordReset({
      email: email.trim().toLowerCase(),
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error && error.status !== 429) {
      setErrorMessage(getAuthErrorMessage(error));
      return;
    }
    setFeedback(true);
    setCooldown(PASSWORD_RESET_EMAIL_COOLDOWN_SECONDS);
  });

  return (
    <AuthLayout>
      {/* A plain glyph, like the empty states: no tile around it. */}
      <div className="mb-4 text-muted-foreground">
        <EnvelopeSimpleIcon aria-hidden="true" className="size-6" />
      </div>
      <AuthFormHeader
        description="Informe seu e-mail para receber um link seguro de redefinição."
        title="Recupere sua senha"
      />

      <form className="grid gap-4" noValidate onSubmit={onSubmit}>
        <AuthEmailField
          error={form.formState.errors.email?.message}
          placeholder="voce@exemplo.com"
          {...form.register("email")}
        />

        {feedback && <AuthFeedback>{NEUTRAL_FEEDBACK}</AuthFeedback>}
        {errorMessage && <AuthFeedback kind="error">{errorMessage}</AuthFeedback>}

        <AuthSubmitButton
          disabled={!form.formState.isValid || cooldown > 0}
          pending={form.formState.isSubmitting}
          pendingLabel="Enviando"
          type="submit"
        >
          {cooldown > 0 ? `Enviar novamente em ${cooldown}s` : "Enviar link"}
        </AuthSubmitButton>
      </form>

      <BackLink className="mt-5" to="/login">
        Voltar para entrar
      </BackLink>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
