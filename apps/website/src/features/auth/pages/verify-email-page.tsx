import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheckIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link, useLocation } from "react-router";

import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { authClient } from "@/features/auth/auth-client.ts";
import { getAuthErrorMessage } from "@/features/auth/auth-messages.ts";
import {
  type VerificationEmailValues,
  verificationEmailSchema,
} from "@/features/auth/auth-schemas.ts";
import { AuthFormHeader } from "@/features/auth/components/auth-form-header.tsx";
import { AuthLayout } from "@/features/auth/components/auth-layout.tsx";

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
      <div className="mb-6 flex size-11 items-center justify-center border border-primary/20 bg-primary/5 text-primary">
        <MailCheckIcon aria-hidden="true" className="size-5" />
      </div>
      <AuthFormHeader
        description="Enviamos um link de confirmação para o seu e-mail. Abra a mensagem para ativar sua conta."
        title="Confirme seu e-mail"
      />

      <form className="grid gap-4" noValidate onSubmit={onSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="verification-email">E-mail</Label>
          <Input
            aria-describedby={form.formState.errors.email ? "verification-email-error" : undefined}
            aria-invalid={Boolean(form.formState.errors.email)}
            autoComplete="email"
            className="h-11"
            id="verification-email"
            inputMode="email"
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p className="text-xs text-destructive" id="verification-email-error">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

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

        <Button
          className="h-11 rounded-none"
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
        </Button>
      </form>

      <Link
        className="mt-5 inline-flex text-sm font-semibold text-foreground underline-offset-4 hover:underline"
        to="/login"
      >
        Voltar para entrar
      </Link>
    </AuthLayout>
  );
};

export default VerifyEmailPage;
