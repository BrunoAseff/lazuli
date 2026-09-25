import { useEffect, useState } from "react";
import { ArrowLeftIcon } from "@phosphor-icons/react/ArrowLeft";
import { EnvelopeSimpleOpenIcon } from "@phosphor-icons/react/EnvelopeSimpleOpen";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "react-router";

import { Spinner } from "@/components/ui/spinner.tsx";
import { authClient } from "@/features/auth/auth-client.ts";
import { getAuthErrorMessage } from "@/features/auth/auth-messages.ts";
import {
  type VerificationEmailValues,
  verificationEmailSchema,
} from "@/features/auth/auth-schemas.ts";
import { AuthFormHeader } from "@/features/auth/components/auth-form-header.tsx";
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
      setFeedback({ kind: "error", message: getAuthErrorMessage(error) });
      return;
    }

    setCooldown(30);
    setFeedback({
      kind: "success",
      message: "Se houver uma conta pendente, enviaremos um novo link de confirmação.",
    });
  });

  return (
    <AuthLayout>
      <div className="mb-5 flex size-11 items-center justify-center rounded-[var(--radius)] border border-primary/25 bg-primary/5 text-primary">
        <EnvelopeSimpleOpenIcon aria-hidden="true" className="size-6" weight="duotone" />
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

        {feedback && (
          <p
            className={
              feedback.kind === "error" ? "text-sm text-destructive" : "text-sm text-primary"
            }
            role={feedback.kind === "error" ? "alert" : "status"}
          >
            {feedback.message}
          </p>
        )}

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

export default VerifyEmailPage;
