import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";

import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { authClient } from "@/features/auth/auth-client.ts";
import { getAuthErrorMessage } from "@/features/auth/auth-messages.ts";
import { registerSchema, type RegisterValues } from "@/features/auth/auth-schemas.ts";
import { AuthFormHeader } from "@/features/auth/components/auth-form-header.tsx";
import { AuthLayout } from "@/features/auth/components/auth-layout.tsx";
import { PasswordInput } from "@/features/auth/components/password-input.tsx";

export const RegisterPage = () => {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<RegisterValues>({
    defaultValues: { confirmPassword: "", email: "", name: "", password: "" },
    mode: "onChange",
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    const email = values.email.trim().toLowerCase();
    const { error } = await authClient.signUp.email({
      callbackURL: `${window.location.origin}/login?verified=true`,
      email,
      name: values.name.trim().replaceAll(/\s+/g, " "),
      password: values.password,
    });

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

      <form className="grid gap-4" noValidate onSubmit={onSubmit}>
        <div className="grid gap-2">
          <Label htmlFor="name">Nome</Label>
          <Input
            aria-describedby={form.formState.errors.name ? "name-error" : undefined}
            aria-invalid={Boolean(form.formState.errors.name)}
            autoComplete="name"
            className="h-11 rounded-none"
            id="name"
            placeholder="Como devemos chamar você?"
            {...form.register("name")}
          />
          {form.formState.errors.name && (
            <p className="text-xs text-destructive" id="name-error">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            aria-describedby={form.formState.errors.email ? "email-error" : undefined}
            aria-invalid={Boolean(form.formState.errors.email)}
            autoComplete="email"
            className="h-11 rounded-none"
            id="email"
            inputMode="email"
            placeholder="voce@exemplo.com"
            {...form.register("email")}
          />
          {form.formState.errors.email && (
            <p className="text-xs text-destructive" id="email-error">
              {form.formState.errors.email.message}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">Senha</Label>
          <PasswordInput
            aria-describedby={form.formState.errors.password ? "password-error" : undefined}
            aria-invalid={Boolean(form.formState.errors.password)}
            autoComplete="new-password"
            id="password"
            {...form.register("password")}
          />
          {form.formState.errors.password && (
            <p className="text-xs text-destructive" id="password-error">
              {form.formState.errors.password.message}
            </p>
          )}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="confirm-password">Confirmar senha</Label>
          <PasswordInput
            aria-describedby={
              form.formState.errors.confirmPassword ? "confirm-password-error" : undefined
            }
            aria-invalid={Boolean(form.formState.errors.confirmPassword)}
            autoComplete="new-password"
            id="confirm-password"
            {...form.register("confirmPassword")}
          />
          {form.formState.errors.confirmPassword && (
            <p className="text-xs text-destructive" id="confirm-password-error">
              {form.formState.errors.confirmPassword.message}
            </p>
          )}
        </div>

        {formError && (
          <p className="text-sm text-destructive" role="alert">
            {formError}
          </p>
        )}

        <Button
          className="mt-1 h-11 rounded-none"
          disabled={!form.formState.isValid || form.formState.isSubmitting}
          type="submit"
        >
          {form.formState.isSubmitting && <Spinner aria-hidden="true" />}
          {form.formState.isSubmitting ? "Criando conta…" : "Criar conta"}
        </Button>
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
