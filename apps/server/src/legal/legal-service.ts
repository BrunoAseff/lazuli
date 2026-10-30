import { createHash, randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { LEGAL_ACCEPTANCE_LABEL, type AcceptLegalInput, type LegalStatus } from "@lazuli/shared";
import { CURRENT_TERMS, CURRENT_PRIVACY, type LegalDocument } from "@lazuli/shared/legal/documents";
import type { Database } from "../database/client.ts";
import { legalAcceptance } from "../database/schema/legal.ts";

export const legalDocumentHash = (document: LegalDocument) =>
  createHash("sha256").update(JSON.stringify(document)).digest("hex");

const termsHash = legalDocumentHash(CURRENT_TERMS);
const privacyHash = legalDocumentHash(CURRENT_PRIVACY);
export const currentLegalStatus = (acceptedAt: Date | null = null): LegalStatus => ({
  accepted: acceptedAt !== null,
  acceptedAt: acceptedAt?.toISOString() ?? null,
  termsVersion: CURRENT_TERMS.version,
  privacyVersion: CURRENT_PRIVACY.version,
});

export const isCurrentLegalEdition = (input: AcceptLegalInput) =>
  input.termsVersion === CURRENT_TERMS.version && input.privacyVersion === CURRENT_PRIVACY.version;

export const getLegalStatus = async (database: Database, userId: string) => {
  const saved = await database.query.legalAcceptance.findFirst({
    where: and(eq(legalAcceptance.userId, userId), eq(legalAcceptance.termsHash, termsHash)),
  });
  return currentLegalStatus(saved?.acceptedAt ?? null);
};

export const recordLegalAcceptance = async (
  database: Database,
  userId: string,
  source: "email-registration" | "account-gate",
) => {
  await database
    .insert(legalAcceptance)
    .values({
      id: randomUUID(),
      userId,
      termsVersion: CURRENT_TERMS.version,
      privacyVersion: CURRENT_PRIVACY.version,
      termsHash,
      privacyHash,
      actionLabel: LEGAL_ACCEPTANCE_LABEL,
      source,
    })
    .onConflictDoNothing();
  return getLegalStatus(database, userId);
};
