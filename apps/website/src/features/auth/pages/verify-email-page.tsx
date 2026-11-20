import { BackLink } from "@/components/nav-link.tsx";
import { useEffect, useState } from "react";
import { VERIFICATION_EMAIL_COOLDOWN_SECONDS } from "@lazuli/shared";
import { EnvelopeSimpleOpenIcon } from "@/components/icons.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useLocation } from "react-router";

import { Spinner } from "@/components/ui/spinner.tsx";
import { authClient } from "@/features/auth/auth-client.ts";
import { getAuthErrorMessage } from "@/features/auth/auth-messages.ts";
import {
  type VerificationEmailValues,
  verificationEmailSchema,
} from "@/features/auth/auth-schemas.ts";
import { AuthFormHeader } from "@/features/auth/components/auth-form-header.tsx";
import { AuthFeedback } from "@/features/auth/components/auth-feedback.tsx";
import { AuthEmailField } from "@/features/auth/components/auth-form-field.tsx";
import { AuthLayout } from "@/features/auth/components/auth-layout.tsx";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button.tsx";

type LocationState = { email?: string };

export const VerifyEmailPage = () => {
  const location = useLocation();
  const initialEmail = (location.state as LocationState | null)?.email ?? "";
  const [cooldown, setCooldown] = useState(0);
  const [feedback, setFeedback] = useState<{
    kind: "error" | "success";
    message: string;
  } | null>(null);
  const form = useForm<VerificationEmailValues>({
    defaultValues: { email: initialEmail },
    mode: "onChange",
    resolver: zodResolver(verificationEmailSchema),
  });

  useEffect(() => {
    if (cooldown === 0) {
      return;
    }

    const timer = window.setTimeout(() => setCooldown((current) => current - 1), 1_000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setFeedback(null);
    const { error } = await authClient.sendVerificationEmail({
      callbackURL: `${window.location.origin}/login?verified=true`,
      email: email.trim().toLowerCase(),
    });

    if (error) {
      if (error.status === 429) {
        setCooldown(VERIFICATION_EMAIL_COOLDOWN_SECONDS);
      }
      setFeedback({ kind: "error", message: getAuthErrorMessage(error) });
      return;
    }

    setCooldown(VERIFICATION_EMAIL_COOLDOWN_SECONDS);
    setFeedback({
      kind: "success",
      message: "Se houver uma conta pendente, enviaremos um novo link de confirmação.",
    });
  });

  return (
    <AuthLayout>
      {/* A plain glyph, like the empty states: no tile around it. */}
      <div className="mb-4 text-muted-foreground">
        <EnvelopeSimpleOpenIcon aria-hidden="true" className="size-6" />
      </div>
      <AuthFormHeader
        description="Enviamos um link de confirmação para o seu e-mail. Abra a mensagem para ativar sua conta."
        title="Confirme seu e-mail"
      />

      <form className="grid gap-4" noValidate onSubmit={onSubmit}>
        <AuthEmailField
          error={form.formState.errors.email?.message}
          id="verification-email"
          {...form.register("email")}
        />

        {feedback && <AuthFeedback kind={feedback.kind}>{feedback.message}</AuthFeedback>}

        <AuthSubmitButton
          disabled={!form.formState.isValid || form.formState.isSubmitting || cooldown > 0}
          type="submit"
          variant="outline"
        >
          {form.formState.isSubmitting && <Spinner aria-hidden="true" />}
          {form.formState.isSubmitting
            ? "Enviando…"
            : cooldown > 0
              ? `Reenviar em ${cooldown}s`
              : "Reenviar e-mail"}
        </AuthSubmitButton>
      </form>

      <BackLink className="mt-5" to="/login">
        Voltar para entrar
      </BackLink>
    </AuthLayout>
  );
};

export default VerifyEmailPage;
