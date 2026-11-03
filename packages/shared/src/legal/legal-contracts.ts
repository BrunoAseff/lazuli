import { z } from "zod";

export const acceptLegalSchema = z
  .object({
    termsVersion: z.string().min(1).max(40),
    privacyVersion: z.string().min(1).max(40),
    accepted: z.literal(true),
  })
  .strict();

export const legalStatusSchema = z.object({
  accepted: z.boolean(),
  acceptedAt: z.iso.datetime().nullable(),
  termsVersion: z.string(),
  privacyVersion: z.string(),
});
export type AcceptLegalInput = z.infer<typeof acceptLegalSchema>;
export type LegalStatus = z.infer<typeof legalStatusSchema>;
