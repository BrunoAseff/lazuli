import type { Auth } from "../auth/auth.ts";
import type { Database } from "../database/client.ts";
import { createStudyCollectionRoutes } from "../study-collections/study-collection-routes.ts";
import {
  createFlashcardCollection,
  deleteFlashcardCollection,
  getFlashcardCollection,
  listFlashcardCollections,
  updateFlashcardCollection,
} from "./flashcard-collection-queries.ts";

export const createFlashcardCollectionRoutes = (options: {
  auth: Auth;
  database: Database;
  websiteUrl: string;
}) =>
  createStudyCollectionRoutes({
    ...options,
    kind: "flashcard",
    listFailedMessage: "Não foi possível carregar suas coleções.",
    path: "flashcard-collections",
    queries: {
      create: createFlashcardCollection,
      get: (database, userId, collectionId) =>
        getFlashcardCollection(database, userId, collectionId),
      list: (database, userId, input) => listFlashcardCollections(database, userId, input),
      remove: deleteFlashcardCollection,
      update: updateFlashcardCollection,
    },
  });
