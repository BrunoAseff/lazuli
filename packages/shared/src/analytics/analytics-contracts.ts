import { z } from "zod";

export const ANALYTICS_CONSENT_VERSION = 1;

export const analyticsConsentStatusSchema = z.enum(["undecided", "granted", "denied"]);
export type AnalyticsConsentStatus = z.infer<typeof analyticsConsentStatusSchema>;

export const analyticsPreferenceSchema = z.object({
  status: analyticsConsentStatusSchema,
  version: z.number().int().positive(),
  decidedAt: z.string().datetime().nullable(),
});
export type AnalyticsPreference = z.infer<typeof analyticsPreferenceSchema>;

export const updateAnalyticsPreferenceSchema = z.object({
  status: z.enum(["granted", "denied"]),
});
export type UpdateAnalyticsPreference = z.infer<typeof updateAnalyticsPreferenceSchema>;

/**
 * Deliberately small, allowlisted event catalog. Event properties must describe
 * product behavior only; never add names, email addresses, titles, document
 * contents, filenames, selected text, provider payloads, or error stacks.
 */
const emptyPropertiesSchema = z.object({}).strict();
const importFormatSchema = z.enum(["pdf", "docx", "markdown", "text", "other"]);
export const analyticsImportFormatFromMimeType = (mimeType: string) => {
  if (mimeType === "application/pdf") return "pdf" as const;
  if (mimeType.includes("wordprocessingml")) return "docx" as const;
  if (mimeType === "text/markdown") return "markdown" as const;
  if (mimeType === "text/plain") return "text" as const;
  return "other" as const;
};
const generationKindSchema = z.enum(["flashcard", "quiz"]);
const generationScopeSchema = z.enum(["selection", "document", "collection", "improvement"]);
const errorCodeSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Z][A-Z0-9_]*$/);
const itemCountSchema = z.number().int().min(1).max(200);

export const analyticsEventSchemas = {
  project_creation_started: emptyPropertiesSchema,
  project_created: emptyPropertiesSchema,
  document_created: z.object({ source: z.enum(["manual", "import"]) }).strict(),
  document_import_started: z
    .object({ fileCount: z.number().int().min(1).max(5), format: importFormatSchema })
    .strict(),
  document_import_completed: z
    .object({ format: importFormatSchema, warningCount: z.number().int().min(0).max(10_000) })
    .strict(),
  document_import_failed: z
    .object({ errorCode: errorCodeSchema, format: importFormatSchema })
    .strict(),
  ai_generation_started: z
    .object({ kind: generationKindSchema, quantity: itemCountSchema, scope: generationScopeSchema })
    .strict(),
  ai_generation_completed: z
    .object({ kind: generationKindSchema, quantity: itemCountSchema, scope: generationScopeSchema })
    .strict(),
  ai_generation_failed: z
    .object({
      errorCode: errorCodeSchema,
      kind: generationKindSchema,
      scope: generationScopeSchema,
    })
    .strict(),
  ai_proposal_approved: z
    .object({ kind: generationKindSchema, quantity: itemCountSchema, scope: generationScopeSchema })
    .strict(),
  practice_started: z.object({ kind: generationKindSchema, itemCount: itemCountSchema }).strict(),
  practice_completed: z.object({ kind: generationKindSchema, itemCount: itemCountSchema }).strict(),
  checkout_started: z.object({ plan: z.enum(["essential", "specialist"]) }).strict(),
  subscription_activated: z.object({ plan: z.enum(["essential", "specialist"]) }).strict(),
  upgrade_prompt_shown: z
    .object({
      reason: z.enum(["credits", "projects", "storage"]),
      currentPlan: z.enum(["basic", "essential", "specialist"]),
    })
    .strict(),
} as const;

export type AnalyticsEventName = keyof typeof analyticsEventSchemas;
export type AnalyticsEventProperties = {
  [Name in AnalyticsEventName]: z.infer<(typeof analyticsEventSchemas)[Name]>;
};
