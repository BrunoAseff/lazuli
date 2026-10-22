import { ACCOUNT_RETENTION_RECOMMENDED, type AccountExportCategory } from "@lazuli/shared";
import { and, desc, eq, ne } from "drizzle-orm";

import type { Database } from "../database/client.ts";
import {
  account,
  accountExport,
  session,
  user,
  userStudyPreference,
} from "../database/schema/index.ts";

export const getAccountProfile = async (
  database: Database,
  userId: string,
  googleEnabled: boolean,
) => {
  const [owner, accounts] = await Promise.all([
    database.select().from(user).where(eq(user.id, userId)).limit(1),
    database
      .select({ providerId: account.providerId })
      .from(account)
      .where(eq(account.userId, userId)),
  ]);
  if (!owner[0]) return null;
  const methods = [...new Set(accounts.map(({ providerId }) => providerId))].filter(
    (providerId): providerId is "credential" | "google" =>
      providerId === "credential" || providerId === "google",
  );
  return {
    email: owner[0].email,
    emailVerified: owner[0].emailVerified,
    googleEnabled,
    image: owner[0].image,
    methods,
    name: owner[0].name,
  };
};

export const getStudyPreference = async (database: Database, userId: string) => {
  const [preference] = await database
    .select({ desiredRetention: userStudyPreference.desiredRetention })
    .from(userStudyPreference)
    .where(eq(userStudyPreference.userId, userId))
    .limit(1);
  return {
    desiredRetention: preference?.desiredRetention ?? ACCOUNT_RETENTION_RECOMMENDED,
    isDefault: !preference,
  };
};

export const updateStudyPreference = async (
  database: Database,
  userId: string,
  desiredRetention: number,
) => {
  if (desiredRetention === ACCOUNT_RETENTION_RECOMMENDED) {
    await database.delete(userStudyPreference).where(eq(userStudyPreference.userId, userId));
    return getStudyPreference(database, userId);
  }
  await database
    .insert(userStudyPreference)
    .values({ desiredRetention, userId })
    .onConflictDoUpdate({
      target: userStudyPreference.userId,
      set: { desiredRetention, updatedAt: new Date() },
    });
  return getStudyPreference(database, userId);
};

export const listSafeSessions = async (
  database: Database,
  userId: string,
  currentSessionId: string,
) => {
  const items = await database
    .select({
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      id: session.id,
      updatedAt: session.updatedAt,
      userAgent: session.userAgent,
    })
    .from(session)
    .where(eq(session.userId, userId))
    .orderBy(desc(session.updatedAt), desc(session.createdAt));
  return {
    items: items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      expiresAt: item.expiresAt.toISOString(),
      isCurrent: item.id === currentSessionId,
      updatedAt: item.updatedAt.toISOString(),
    })),
  };
};

export const revokeOwnedSession = async (database: Database, userId: string, sessionId: string) => {
  const deleted = await database
    .delete(session)
    .where(and(eq(session.id, sessionId), eq(session.userId, userId)))
    .returning({ id: session.id });
  return deleted.length > 0;
};

export const revokeOtherOwnedSessions = (database: Database, userId: string, currentId: string) =>
  database.delete(session).where(and(eq(session.userId, userId), ne(session.id, currentId)));

export const createAccountExport = async (
  database: Database,
  userId: string,
  categories: AccountExportCategory[],
) => {
  const id = crypto.randomUUID();
  const [created] = await database
    .insert(accountExport)
    .values({ categories, id, userId })
    .onConflictDoNothing()
    .returning({ id: accountExport.id });
  return created?.id ?? null;
};
