import { describe, expect, it } from "vitest";

import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "./auth-schemas.ts";

describe("authentication form schemas", () => {
  it("accepts a complete registration", () => {
    const result = registerSchema.safeParse({
      confirmPassword: "correct-horse",
      email: "aluna@example.com",
      name: "Ana Silva",
      password: "correct-horse",
      acceptedTerms: true,
    });

    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords and invalid account fields", () => {
    const result = registerSchema.safeParse({
      confirmPassword: "different-password",
      email: "not-an-email",
      name: " ",
      password: "short",
      acceptedTerms: false,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toMatchObject({
        confirmPassword: ["As senhas precisam ser iguais."],
        email: ["Informe um e-mail válido."],
        name: expect.any(Array),
        password: ["A senha deve ter pelo menos 8 caracteres."],
      });
    }
  });

  it("keeps remember me as an explicit login choice", () => {
    expect(
      loginSchema.safeParse({
        email: "aluna@example.com",
        password: "secret",
        rememberMe: false,
      }).success,
    ).toBe(true);
    expect(loginSchema.safeParse({ email: "aluna@example.com", password: "secret" }).success).toBe(
      false,
    );
  });

  it("does not infer agreement from a valid registration", () => {
    const input = {
      name: "Ana Silva",
      email: "aluna@example.com",
      password: "correct-horse",
      confirmPassword: "correct-horse",
    };
    expect(registerSchema.safeParse(input).success).toBe(false);
    expect(registerSchema.safeParse({ ...input, acceptedTerms: false }).success).toBe(false);
    expect(registerSchema.safeParse({ ...input, acceptedTerms: true }).success).toBe(true);
  });

  it("uses the registration password rules when resetting a password", () => {
    expect(
      resetPasswordSchema.safeParse({
        confirmPassword: "correct-horse",
        password: "correct-horse",
      }).success,
    ).toBe(true);

    const result = resetPasswordSchema.safeParse({
      confirmPassword: "different",
      password: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors).toMatchObject({
        confirmPassword: ["As senhas precisam ser iguais."],
        password: ["A senha deve ter pelo menos 8 caracteres."],
      });
    }
  });

  it("requires a valid email before requesting a password reset", () => {
    expect(forgotPasswordSchema.safeParse({ email: "aluna@example.com" }).success).toBe(true);
    expect(forgotPasswordSchema.safeParse({ email: "invalid" }).success).toBe(false);
  });
});
