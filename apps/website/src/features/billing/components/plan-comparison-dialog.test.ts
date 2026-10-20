import type { CommercialSummary } from "@lazuli/shared";
import { describe, expect, it } from "vitest";

import { canSelectPlan, getPlanAction } from "./plan-comparison-dialog.tsx";

const summary = (
  overrides: Partial<
    Pick<CommercialSummary, "billingAction" | "entitlementSource" | "plan" | "subscription">
  > = {},
): Pick<
  CommercialSummary,
  "billingAction" | "capabilities" | "entitlementSource" | "plan" | "subscription"
> => ({
  billingAction: "checkout",
  capabilities: {
    canCancel: false,
    canCreateProject: true,
    canGenerate: true,
    canOpenBillingPortal: false,
    canUpgrade: true,
    canUpload: true,
  },
  entitlementSource: "basic",
  plan: "basic",
  subscription: null,
  ...overrides,
});

describe("plan comparison actions", () => {
  it("marks a free effective plan as current", () => {
    expect(getPlanAction("basic", summary())).toBe("Plano atual");
  });

  it("offers checkout to a free account", () => {
    expect(getPlanAction("essential", summary())).toBe("Escolher plano");
  });

  it("describes paid plan changes and cancelation explicitly", () => {
    const paid = summary({
      billingAction: "portal",
      entitlementSource: "stripe",
      plan: "essential",
      subscription: {
        accessUntil: null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: "2027-01-15T12:00:00.000Z",
        plan: "essential",
        status: "active",
      },
    });
    paid.capabilities.canOpenBillingPortal = true;
    expect(getPlanAction("specialist", paid)).toBe("Trocar para Especialista");
    expect(getPlanAction("basic", paid)).toBe("Trocar para Básico");
    expect(getPlanAction("essential", paid)).toBe("Cancelar assinatura");
  });

  it("represents a scheduled cancelation without offering to cancel twice", () => {
    const canceling = summary({
      billingAction: "portal",
      entitlementSource: "stripe",
      plan: "specialist",
      subscription: {
        accessUntil: "2027-01-15T12:00:00.000Z",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: "2027-01-15T12:00:00.000Z",
        plan: "specialist",
        status: "active",
      },
    });
    canceling.capabilities.canOpenBillingPortal = true;
    expect(getPlanAction("specialist", canceling)).toBe("Reativar assinatura");
    expect(getPlanAction("basic", canceling)).toBe("Troca agendada");
    expect(getPlanAction("essential", canceling)).toBe("Trocar para Essencial");
    expect(canSelectPlan("specialist", canceling)).toBe(true);
    expect(canSelectPlan("basic", canceling)).toBe(false);
  });

  it("uses explicit recovery actions for billing problems", () => {
    const pastDue = summary({
      billingAction: "portal",
      entitlementSource: "stripe",
      plan: "essential",
      subscription: {
        accessUntil: null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: "2027-01-15T12:00:00.000Z",
        plan: "essential",
        status: "past_due",
      },
    });
    expect(getPlanAction("essential", pastDue)).toBe("Atualizar pagamento");

    const paused = summary({
      billingAction: "portal",
      subscription: {
        accessUntil: null,
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        plan: "essential",
        status: "paused",
      },
    });
    expect(getPlanAction("essential", paused)).toBe("Retomar assinatura");
    expect(getPlanAction("basic", paused)).toBe("Plano atual");
    expect(canSelectPlan("essential", paused)).toBe(true);
    expect(canSelectPlan("basic", paused)).toBe(false);
  });

  it("does not promise a cancelation for an administrative grant", () => {
    const admin = summary({ entitlementSource: "admin", plan: "specialist" });
    expect(getPlanAction("basic", admin)).toBe("Concessão administrativa");
    expect(getPlanAction("essential", admin)).toBe("Concessão administrativa");
  });
});
