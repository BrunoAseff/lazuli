export const AI_CREDITS_PER_MATERIAL = 10;
export const AI_TEST_PARTICIPANT_GRANT = 300;
export const AI_FREE_REGENERATIONS = 3;
export const AI_CREDIT_RESERVATION_TIMEOUT_MS = 10 * 60 * 1_000;
export const AI_CREDIT_RECONCILIATION_INTERVAL_MS = 60 * 1_000;
export const AI_CREDIT_AUDIT_INTERVAL_MS = 15 * 60 * 1_000;

export const estimateAiCredits = (requestedItems: number) =>
  requestedItems * AI_CREDITS_PER_MATERIAL;

export const consumedAiCredits = (validItems: number) => validItems * AI_CREDITS_PER_MATERIAL;

export const calculateAiCreditSettlement = (reservedCredits: number, validItems: number) => {
  const consumed = Math.min(reservedCredits, consumedAiCredits(validItems));
  return { consumed, released: reservedCredits - consumed };
};
