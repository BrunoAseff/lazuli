export const exceedsCommercialLimit = (
  enforcementEnabled: boolean,
  projectedUsage: number,
  limit: number,
) => enforcementEnabled && projectedUsage > limit;
