import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";

import { Input } from "@/components/ui/input.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from "@lazuli/shared";
import { Spinner } from "@/components/ui/spinner.tsx";
import { authClient } from "@/features/auth/auth-client.ts";
import { getAuthErrorMessage } from "@/features/auth/auth-messages.ts";
import { registerSchema, type RegisterValues } from "@/features/auth/auth-schemas.ts";
import { AuthFormHeader } from "@/features/auth/components/auth-form-header.tsx";
import { AuthFeedback } from "@/features/auth/components/auth-feedback.tsx";
import {
  AuthEmailField,
  AuthFormField,
  AuthPasswordField,
} from "@/features/auth/components/auth-form-field.tsx";
import { AuthLayout } from "@/features/auth/components/auth-layout.tsx";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button.tsx";
import { GoogleAuthOption } from "@/features/auth/components/google-auth-option.tsx";

export const RegisterPage = () => {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<RegisterValues>({
    defaultValues: { confirmPassword: "", email: "", name: "", password: "", acceptedTerms: false },
    mode: "onChange",
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const email = values.email.trim().toLowerCase();
    const { error } = await authClient.signUp.email(
      {
        callbackURL: `${window.location.origin}/login?verified=true`,
        email,
        name: values.name.trim().replaceAll(/\s+/g, " "),
        password: values.password,
      },
      {
        body: {
          legalAcceptance: {
            accepted: values.acceptedTerms,
            termsVersion: CURRENT_TERMS_VERSION,
            privacyVersion: CURRENT_PRIVACY_VERSION,
          },
        },
      },
    );

    if (error) {
      setFormError(
        getAuthErrorMessage(error, "Não foi possível criar sua conta. Tente novamente."),
      );
      return;
    }

    await navigate("/verify-email", { replace: true, state: { email } });
  });

  return (
    <AuthLayout>
      <AuthFormHeader
        description="Comece sua base pessoal de conhecimento com uma conta gratuita."
        title="Crie sua conta"
      />

      <GoogleAuthOption />

      <form className="grid gap-4" noValidate onSubmit={onSubmit}>
        <AuthFormField error={form.formState.errors.name?.message} id="name" label="Nome">
          <Input
            aria-describedby={form.formState.errors.name ? "name-error" : undefined}
            aria-invalid={Boolean(form.formState.errors.name)}
            autoComplete="name"
            className="h-11"
            id="name"
            placeholder="Como devemos chamar você?"
            {...form.register("name")}
          />
        </AuthFormField>

        <AuthEmailField
          error={form.formState.errors.email?.message}
          placeholder="voce@exemplo.com"
          {...form.register("email")}
        />

        <AuthPasswordField
          autoComplete="new-password"
          error={form.formState.errors.password?.message}
          id="password"
          label="Senha"
          {...form.register("password")}
        />

        <AuthPasswordField
          autoComplete="new-password"
          error={form.formState.errors.confirmPassword?.message}
          id="confirm-password"
          label="Confirmar senha"
          {...form.register("confirmPassword")}
        />

        {formError && <AuthFeedback kind="error">{formError}</AuthFeedback>}

        <div className="flex items-start gap-3 text-sm">
          <Checkbox
            id="register-terms"
            className="mt-0.5"
            checked={form.watch("acceptedTerms")}
            disabled={form.formState.isSubmitting}
            onCheckedChange={(checked) =>
              form.setValue("acceptedTerms", checked === true, { shouldValidate: true })
            }
          />
          <label htmlFor="register-terms">
            Concordo com os{" "}
            <Link
              className="underline underline-offset-4"
              to="/termos"
              target="_blank"
              rel="noopener noreferrer"
            >
              Termos de Uso
            </Link>
            .
          </label>
        </div>

        <AuthSubmitButton
          className="mt-1"
          disabled={!form.formState.isValid || form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting && <Spinner aria-hidden="true" />}
          {form.formState.isSubmitting ? "Criando conta…" : "Criar conta"}
        </AuthSubmitButton>
      </form>

      <p className="mt-7 text-center text-sm text-muted-foreground">
        Já tem uma conta?{" "}
        <Link
          className="font-semibold text-foreground underline-offset-4 hover:underline"
          to="/login"
        >
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
};

export default RegisterPage;
