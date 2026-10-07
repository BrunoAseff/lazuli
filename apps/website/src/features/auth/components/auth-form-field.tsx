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
  labelAction,
}: {
  children: ReactNode;
  error?: string;
  id: string;
  label: string;
  labelAction?: ReactNode;
}) => (
  <div className="grid gap-2">
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id}>{label}</Label>
      {labelAction}
    </div>
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
  labelAction,
  ...props
}: ComponentProps<typeof PasswordInput> & {
  error?: string;
  id: string;
  label: string;
  labelAction?: ReactNode;
}) => (
  <AuthFormField error={error} id={id} label={label} labelAction={labelAction}>
    <PasswordInput
      aria-describedby={error ? `${id}-error` : undefined}
      aria-invalid={Boolean(error)}
      id={id}
      {...props}
    />
  </AuthFormField>
);
