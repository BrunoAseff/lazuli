import { z } from "zod";

export const searchKindSchema = z.enum([
  "project",
  "document",
  "flashcards",
  "flashcard",
  "quizzes",
  "question",
]);
export const globalSearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(200),
  kind: searchKindSchema.optional(),
  favorites: z.boolean().default(false),
  page: z.number().int().min(1).max(100).default(1),
});
export const searchResultSchema = z.object({
  kind: searchKindSchema,
  id: z.string(),
  title: z.string(),
  context: z.string().nullable(),
  snippet: z.string(),
  href: z.string(),
});
export const globalSearchResponseSchema = z.object({
  items: z.array(searchResultSchema),
  hasMore: z.boolean(),
});
export type SearchResult = z.infer<typeof searchResultSchema>;
export type SearchKind = z.infer<typeof searchKindSchema>;
export type GlobalSearchInput = z.infer<typeof globalSearchRequestSchema>;
