import { describe, expect, it } from "vitest";

import {
  createAccountExportSchema,
  deleteAccountSchema,
  updateStudyPreferenceSchema,
} from "./account-settings-contracts.ts";

describe("account settings contracts", () => {
  it("accepts only the supported retention interval", () => {
    expect(updateStudyPreferenceSchema.parse({ desiredRetention: 90 })).toEqual({
      desiredRetention: 90,
    });
    expect(updateStudyPreferenceSchema.safeParse({ desiredRetention: 79 }).success).toBe(false);
    expect(updateStudyPreferenceSchema.safeParse({ desiredRetention: 96 }).success).toBe(false);
    expect(updateStudyPreferenceSchema.safeParse({ desiredRetention: 90.5 }).success).toBe(false);
  });

  it("deduplicates export categories and rejects an empty selection", () => {
    expect(
      createAccountExportSchema.parse({ categories: ["account", "projects", "account"] }),
    ).toEqual({ categories: ["account", "projects"] });
    expect(createAccountExportSchema.safeParse({ categories: [] }).success).toBe(false);
    expect(createAccountExportSchema.safeParse({ categories: ["sessions"] }).success).toBe(false);
  });

  it("requires the exact confirmation shape without accepting unknown fields", () => {
    expect(
      deleteAccountSchema.parse({ confirmationEmail: "ana@example.com", password: "secret" }),
    ).toEqual({ confirmationEmail: "ana@example.com", password: "secret" });
    expect(deleteAccountSchema.safeParse({ confirmationEmail: "not-an-email" }).success).toBe(
      false,
    );
  });
});
