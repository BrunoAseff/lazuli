import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";

import { Checkbox } from "@/components/ui/checkbox.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { authClient } from "@/features/auth/auth-client.ts";
import { getAuthErrorMessage } from "@/features/auth/auth-messages.ts";
import { loginSchema, type LoginValues } from "@/features/auth/auth-schemas.ts";
import { AuthFormHeader } from "@/features/auth/components/auth-form-header.tsx";
import { AuthFeedback } from "@/features/auth/components/auth-feedback.tsx";
import { AuthEmailField, AuthPasswordField } from "@/features/auth/components/auth-form-field.tsx";
import { AuthLayout } from "@/features/auth/components/auth-layout.tsx";
import { AuthSubmitButton } from "@/features/auth/components/auth-submit-button.tsx";

type LocationState = {
  from?: string;
};

export const LoginPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const form = useForm<LoginValues>({
    defaultValues: { email: "", password: "", rememberMe: true },
    mode: "onChange",
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    setUnverifiedEmail(null);

    const { error } = await authClient.signIn.email({
      email: values.email.trim().toLowerCase(),
      password: values.password,
      rememberMe: values.rememberMe,
    });

    if (error) {
      setFormError(getAuthErrorMessage(error, "E-mail ou senha incorretos."));
      if (error.code === "EMAIL_NOT_VERIFIED" || error.status === 403) {
        setUnverifiedEmail(values.email.trim().toLowerCase());
      }
      return;
    }

    const destination = (location.state as LocationState | null)?.from ?? "/documents";
    await navigate(destination, { replace: true });
  });

  const verificationError = searchParams.get("error");

  return (
    <AuthLayout>
      <AuthFormHeader
        description="Entre para continuar organizando e revisando o que você aprende."
        title="Bem-vindo de volta"
      />

      {searchParams.get("verified") === "true" && !verificationError && (
        <AuthFeedback className="mb-5">E-mail confirmado. Agora você pode entrar.</AuthFeedback>
      )}

      {searchParams.get("passwordReset") === "true" && (
        <AuthFeedback className="mb-5">Senha redefinida. Entre com sua nova senha.</AuthFeedback>
      )}

      {verificationError && (
        <AuthFeedback className="mb-5" kind="error">
          <p>{getAuthErrorMessage({ code: verificationError })}</p>
          <Link
            className="mt-2 inline-flex font-semibold underline-offset-4 hover:underline"
            to="/verify-email"
          >
            Solicitar novo link
          </Link>
        </AuthFeedback>
      )}

      <form className="grid gap-5" noValidate onSubmit={onSubmit}>
        <AuthEmailField
          error={form.formState.errors.email?.message}
          placeholder="voce@exemplo.com"
          {...form.register("email")}
        />

        <AuthPasswordField
          autoComplete="current-password"
          error={form.formState.errors.password?.message}
          id="password"
          label="Senha"
          labelAction={
            <Link
              className="text-sm font-normal text-primary transition-colors hover:text-primary/80"
              to="/forgot-password"
            >
              Esqueci minha senha
            </Link>
          }
          {...form.register("password")}
        />

        <div className="flex items-center gap-2">
          <Checkbox
            checked={form.watch("rememberMe")}
            id="remember-me"
            onCheckedChange={(checked) => form.setValue("rememberMe", checked === true)}
          />
          <Label className="font-normal" htmlFor="remember-me">
            Lembrar de mim
          </Label>
        </div>

        {formError && (
          <AuthFeedback className="space-y-2" kind="error">
            <p>{formError}</p>
            {unverifiedEmail && (
              <Link
                className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
                state={{ email: unverifiedEmail }}
                to="/verify-email"
              >
                Reenviar e-mail de confirmação
              </Link>
            )}
          </AuthFeedback>
        )}

        <AuthSubmitButton
          disabled={!form.formState.isValid || form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting && <Spinner aria-hidden="true" />}
          {form.formState.isSubmitting ? "Entrando…" : "Entrar"}
        </AuthSubmitButton>
      </form>

      <p className="mt-7 text-center text-sm text-muted-foreground">
        Ainda não tem uma conta?{" "}
        <Link
          className="font-semibold text-foreground underline-offset-4 hover:underline"
          to="/register"
        >
          Criar conta
        </Link>
      </p>
    </AuthLayout>
  );
};

export default LoginPage;
