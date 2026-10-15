import { z } from "zod";
import { AUTH_PASSWORD_MAX_LENGTH, AUTH_PASSWORD_MIN_LENGTH } from "@lazuli/shared";

const email = z.string().trim().min(1, "Informe seu e-mail.").email("Informe um e-mail válido.");
const password = z
  .string()
  .min(1, "Informe sua senha.")
  .min(
    AUTH_PASSWORD_MIN_LENGTH,
    `A senha deve ter pelo menos ${AUTH_PASSWORD_MIN_LENGTH} caracteres.`,
  )
  .max(
    AUTH_PASSWORD_MAX_LENGTH,
    `A senha deve ter no máximo ${AUTH_PASSWORD_MAX_LENGTH} caracteres.`,
  );

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe sua senha."),
  rememberMe: z.boolean(),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Informe seu nome.")
      .min(2, "O nome deve ter pelo menos 2 caracteres.")
      .max(80, "O nome deve ter no máximo 80 caracteres."),
    email,
    password,
    confirmPassword: z.string().min(1, "Confirme sua senha."),
  })
  .refine(({ confirmPassword, password }) => confirmPassword === password, {
    message: "As senhas precisam ser iguais.",
    path: ["confirmPassword"],
  });

export const verificationEmailSchema = z.object({ email });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string().min(1, "Confirme sua senha."),
  })
  .refine(({ confirmPassword, password }) => confirmPassword === password, {
    message: "As senhas precisam ser iguais.",
    path: ["confirmPassword"],
  });

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type VerificationEmailValues = z.infer<typeof verificationEmailSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
