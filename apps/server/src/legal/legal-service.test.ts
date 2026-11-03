import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
  LEGAL_ACCEPTANCE_LABEL,
} from "@lazuli/shared";
import { CURRENT_TERMS, CURRENT_PRIVACY, getLegalDocument } from "@lazuli/shared/legal/documents";
import type { Database } from "../database/client.ts";
import {
  getLegalStatus,
  legalDocumentHash,
  recordLegalAcceptance,
  isCurrentLegalEdition,
} from "./legal-service.ts";

describe("acceptance evidence", () => {
  it("accepts the client editions only when their public documents match the server requirement", () => {
    expect(
      isCurrentLegalEdition({
        accepted: true,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
      }),
    ).toBe(true);
    expect(getLegalDocument("terms", CURRENT_TERMS_VERSION)).toBe(CURRENT_TERMS);
    expect(getLegalDocument("privacy", CURRENT_PRIVACY_VERSION)).toBe(CURRENT_PRIVACY);
    expect(getLegalDocument("terms", "missing-edition")).toBeUndefined();
  });
  it("preserves the exact published texts behind existing acceptance records", () => {
    // Changing a published text requires a new edition, not updating these expectations in place.
    expect(legalDocumentHash(CURRENT_TERMS)).toBe(
      "dcfeddc4ed6dc4fc0c492a6675d631f1ad8f3f5f647d873e33897565817e5b39",
    );
    expect(legalDocumentHash(CURRENT_PRIVACY)).toBe(
      "d379ccab38d81922dbf69cd4da58f18372add94c8f7157006029cc9adb26738b",
    );
  });
  it("does not infer agreement for an existing account", async () => {
    const database = {
      query: { legalAcceptance: { findFirst: vi.fn().mockResolvedValue(undefined) } },
    } as unknown as Database;
    expect((await getLegalStatus(database, "existing-user")).accepted).toBe(false);
  });

  it("qualifies access by the accepted contract, not by consent to a newer privacy notice", async () => {
    const findFirst = vi.fn().mockResolvedValue({ acceptedAt: new Date("2026-10-29T12:00:00Z") });
    const database = { query: { legalAcceptance: { findFirst } } } as unknown as Database;
    expect((await getLegalStatus(database, "user-1")).accepted).toBe(true);
    const query = new PgDialect().sqlToQuery(findFirst.mock.calls[0]![0].where);
    expect(query.params).toContain("user-1");
    expect(query.params).toContain(legalDocumentHash(CURRENT_TERMS));
    expect(query.params).not.toContain(legalDocumentHash(CURRENT_PRIVACY));
  });
  it("preserves the first server timestamp on repeated acceptance", async () => {
    let saved: Record<string, unknown> | undefined;
    let pending: Record<string, unknown>;
    const now = new Date("2026-10-29T12:00:00Z");
    const values = vi.fn((value: Record<string, unknown>) => {
      pending = value;
      return {
        onConflictDoNothing: async () => {
          saved ??= { ...pending, acceptedAt: now };
        },
      };
    });
    const database = {
      insert: () => ({ values }),
      query: { legalAcceptance: { findFirst: async () => saved } },
    } as unknown as Database;
    const first = await recordLegalAcceptance(database, "user-1", "email-registration");
    const repeated = await recordLegalAcceptance(database, "user-1", "account-gate");
    expect(repeated).toEqual(first);
    expect(saved).toMatchObject({
      userId: "user-1",
      actionLabel: LEGAL_ACCEPTANCE_LABEL,
      source: "email-registration",
      termsHash: legalDocumentHash(CURRENT_TERMS),
      privacyHash: legalDocumentHash(CURRENT_PRIVACY),
    });
    expect(values.mock.calls[0]![0]).not.toHaveProperty("acceptedAt");
  });
});
