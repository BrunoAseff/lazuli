import type { Auth } from "../auth/auth.ts";
import type { Database } from "../database/client.ts";
import { createStudyCollectionRoutes } from "../study-collections/study-collection-routes.ts";
import {
  createQuizCollection,
  deleteQuizCollection,
  getQuizCollection,
  listQuizCollections,
  updateQuizCollection,
} from "./quiz-collection-queries.ts";

export const createQuizCollectionRoutes = (options: {
  auth: Auth;
  database: Database;
  websiteUrl: string;
}) =>
  createStudyCollectionRoutes({
    ...options,
    kind: "quiz",
    listFailedMessage: "Não foi possível carregar suas coleções de quizzes.",
    path: "quiz-collections",
    queries: {
      create: createQuizCollection,
      get: (database, userId, collectionId) => getQuizCollection(database, userId, collectionId),
      list: (database, userId, input) => listQuizCollections(database, userId, input),
      remove: deleteQuizCollection,
      update: updateQuizCollection,
    },
  });
