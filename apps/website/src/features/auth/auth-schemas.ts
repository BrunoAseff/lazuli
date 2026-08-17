import { z } from "zod";

const email = z.string().trim().min(1, "Informe seu e-mail.").email("Informe um e-mail válido.");
const password = z
  .string()
  .min(1, "Informe sua senha.")
  .min(8, "A senha deve ter pelo menos 8 caracteres.")
  .max(128, "A senha deve ter no máximo 128 caracteres.");

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

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
export type VerificationEmailValues = z.infer<typeof verificationEmailSchema>;
