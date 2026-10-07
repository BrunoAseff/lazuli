import { useEffect, useState } from "react";
import { PASSWORD_RESET_EMAIL_COOLDOWN_SECONDS } from "@lazuli/shared";
import { ArrowLeftIcon } from "@phosphor-icons/react/ArrowLeft";
import { EnvelopeSimpleIcon } from "@phosphor-icons/react/EnvelopeSimple";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router";

import { Spinner } from "@/components/ui/spinner.tsx";
import { authClient } from "@/features/auth/auth-client.ts";
import { forgotPasswordSchema, type ForgotPasswordValues } from "@/features/auth/auth-schemas.ts";
import { AuthFormHeader } from "@/features/auth/components/auth-form-header.tsx";
import { AuthFeedback } from "@/features/auth/components/auth-feedback.tsx";
import { AuthEmailField } from "@/features/auth/components/auth-form-field.tsx";
import { AuthLayout } from "@/features/auth/components/auth-layout.tsx";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button.tsx";

const NEUTRAL_FEEDBACK =
  "Se houver uma conta com este e-mail, enviaremos um link para redefinir a senha.";

export const ForgotPasswordPage = () => {
  const [cooldown, setCooldown] = useState(0);
  const [feedback, setFeedback] = useState(false);
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
    const { error } = await authClient.requestPasswordReset({
      email: email.trim().toLowerCase(),
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setFeedback(true);
    if (!error || error.status === 429) {
      setCooldown(PASSWORD_RESET_EMAIL_COOLDOWN_SECONDS);
    }
  });

  return (
    <AuthLayout>
      <div className="mb-5 flex size-11 items-center justify-center rounded-[var(--radius)] border border-primary/25 bg-primary/5 text-primary">
        <EnvelopeSimpleIcon aria-hidden="true" className="size-6" weight="duotone" />
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

        <AuthSubmitButton
          disabled={!form.formState.isValid || form.formState.isSubmitting || cooldown > 0}
          type="submit"
        >
          {form.formState.isSubmitting && <Spinner aria-hidden="true" />}
          {form.formState.isSubmitting
            ? "Enviando…"
            : cooldown > 0
              ? `Enviar novamente em ${cooldown}s`
              : "Enviar link"}
        </AuthSubmitButton>
      </form>

      <Link
        className="mt-5 inline-flex w-fit items-center gap-1.5 text-sm font-normal text-muted-foreground transition-colors hover:text-foreground"
        to="/login"
      >
        <ArrowLeftIcon aria-hidden="true" className="size-3.5" />
        Voltar para entrar
      </Link>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
