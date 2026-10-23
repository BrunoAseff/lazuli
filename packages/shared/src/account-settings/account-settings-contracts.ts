import { z } from "zod";
import { commercialSummarySchema } from "../billing/billing-contracts.ts";

export const accountUsageSchema = z.object({
  commercial: commercialSummarySchema,
  library: z.object({
    projects: z.number().nonnegative(),
    documents: z.number().nonnegative(),
    flashcardCollections: z.number().nonnegative(),
    archivedFlashcardCollections: z.number().nonnegative(),
    flashcards: z.number().nonnegative(),
    quizzes: z.number().nonnegative(),
    archivedQuizzes: z.number().nonnegative(),
    questions: z.number().nonnegative(),
  }),
  cycle: z.object({
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    consumed: z.number().nonnegative(),
  }),
});

export const ACCOUNT_RETENTION_MIN = 80;
export const ACCOUNT_RETENTION_MAX = 95;
export const ACCOUNT_RETENTION_RECOMMENDED = 90;

export const accountSettingsProfileSchema = z.object({
  email: z.email(),
  emailVerified: z.boolean(),
  googleEnabled: z.boolean(),
  image: z.string().nullable(),
  methods: z.array(z.enum(["credential", "google"])),
  name: z.string(),
});

export const authCapabilitiesSchema = z.object({ google: z.boolean() });

export const updateAccountNameSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

export const studyPreferenceSchema = z.object({
  desiredRetention: z.number().int().min(ACCOUNT_RETENTION_MIN).max(ACCOUNT_RETENTION_MAX),
  isDefault: z.boolean(),
});

export const updateStudyPreferenceSchema = z.object({
  desiredRetention: z.number().int().min(ACCOUNT_RETENTION_MIN).max(ACCOUNT_RETENTION_MAX),
});

export const accountSessionSchema = z.object({
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  id: z.string(),
  isCurrent: z.boolean(),
  updatedAt: z.iso.datetime(),
  userAgent: z.string().nullable(),
});

export const accountSessionsSchema = z.object({ items: z.array(accountSessionSchema) });

export const accountExportCategorySchema = z.enum([
  "account",
  "projects",
  "flashcards",
  "quizzes",
  "references",
]);

export const createAccountExportSchema = z.object({
  categories: z
    .array(accountExportCategorySchema)
    .min(1)
    .max(5)
    .transform((items) => [...new Set(items)]),
});

export const deleteAccountSchema = z.object({
  confirmationEmail: z.email(),
  password: z.string().min(1).optional(),
});

export type AccountExportCategory = z.infer<typeof accountExportCategorySchema>;
export type AccountSession = z.infer<typeof accountSessionSchema>;
export type AccountSettingsProfile = z.infer<typeof accountSettingsProfileSchema>;
export type CreateAccountExportInput = z.input<typeof createAccountExportSchema>;
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
export type StudyPreference = z.infer<typeof studyPreferenceSchema>;
export type UpdateStudyPreferenceInput = z.infer<typeof updateStudyPreferenceSchema>;
