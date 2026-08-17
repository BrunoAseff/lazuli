import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema } from "./auth-schemas.ts";

describe("authentication form schemas", () => {
  it("accepts a complete registration", () => {
    const result = registerSchema.safeParse({
      confirmPassword: "correct-horse",
      email: "aluna@example.com",
      name: "Ana Silva",
      password: "correct-horse",
    });

    expect(result.success).toBe(true);
  });

  it("rejects mismatched passwords and invalid account fields", () => {
    const result = registerSchema.safeParse({
      confirmPassword: "different-password",
      email: "not-an-email",
      name: " ",
      password: "short",
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
});
