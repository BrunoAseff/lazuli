import type { ComponentProps, ReactNode } from "react";

import { FormFieldError } from "@/components/form-field-error.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { PasswordInput } from "@/features/auth/components/password-input.tsx";

export const AuthFormField = ({
  children,
  error,
  id,
  label,
}: {
  children: ReactNode;
  error?: string;
  id: string;
  label: string;
}) => (
  <div className="grid gap-2">
    <Label htmlFor={id}>{label}</Label>
    {children}
    <FormFieldError id={`${id}-error`} message={error} />
  </div>
);

export const AuthEmailField = ({
  error,
  id = "email",
  ...props
}: ComponentProps<typeof Input> & { error?: string }) => (
  <AuthFormField error={error} id={id} label="E-mail">
    <Input
      aria-describedby={error ? `${id}-error` : undefined}
      aria-invalid={Boolean(error)}
      autoComplete="email"
      className="h-11"
      id={id}
      inputMode="email"
      {...props}
    />
  </AuthFormField>
);

export const AuthPasswordField = ({
  error,
  id,
  label,
  ...props
}: ComponentProps<typeof PasswordInput> & {
  error?: string;
  id: string;
  label: string;
}) => (
  <AuthFormField error={error} id={id} label={label}>
    <PasswordInput
      aria-describedby={error ? `${id}-error` : undefined}
      aria-invalid={Boolean(error)}
      id={id}
      {...props}
    />
  </AuthFormField>
);
