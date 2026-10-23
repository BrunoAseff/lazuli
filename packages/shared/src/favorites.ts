import { z } from "zod";

export const favoriteKindSchema = z.enum(["project", "document", "flashcards", "quizzes"]);
export const favoriteTargetSchema = z.object({ kind: favoriteKindSchema, id: z.uuid() });
export const favoriteStateRequestSchema = z.object({
  targets: z.array(favoriteTargetSchema).max(100),
});
export const favoriteStatesSchema = z.object({ items: z.array(favoriteTargetSchema) });
export const favoriteListSchema = z.object({
  hasMore: z.boolean().default(false),
  items: z.array(
    favoriteTargetSchema.extend({
      title: z.string(),
      context: z.string().nullable(),
      href: z.string(),
    }),
  ),
});
export const favoriteListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  kind: favoriteKindSchema.optional(),
});
export const favoriteFilterShape = {
  favorites: z.enum(["all", "only"]).optional(),
};
export type FavoriteKind = z.infer<typeof favoriteKindSchema>;
export type FavoriteTarget = z.infer<typeof favoriteTargetSchema>;
