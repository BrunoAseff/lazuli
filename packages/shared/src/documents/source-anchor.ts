import { z } from "zod";

export const sourceAnchorIdSchema = z.string().trim().min(1).max(128);

export const readSourceAnchorId = (styles: Record<string, unknown>) => {
  const parsed = sourceAnchorIdSchema.safeParse(styles.sourceAnchor);
  return parsed.success ? parsed.data : null;
};
