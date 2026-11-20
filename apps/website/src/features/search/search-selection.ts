/**
 * The result Enter opens: the current choice while it is still on screen, otherwise the first
 * result. Without this, typing a query left nothing active and Enter did nothing.
 */
export const resolveActiveResult = (values: string[], selected: string) =>
  values.includes(selected) ? selected : (values[0] ?? "");
