import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

import { user } from "./auth.ts";
import { flashcard } from "./flashcards.ts";
import { project } from "./projects.ts";

export const projectItemType = pgEnum("project_item_type", ["folder", "document"]);
export const documentImportStatus = pgEnum("document_import_status", [
  "uploading",
  "queued",
  "processing",
  "finalizing",
  "completed",
  "failed",
  "canceled",
]);
export const documentImportPhase = pgEnum("document_import_phase", [
  "validating",
  "extracting",
  "converting",
  "finalizing",
]);

export const projectItem = pgTable(
  "project_item",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    parentId: text("parent_id").references((): AnyPgColumn => projectItem.id, {
      onDelete: "cascade",
    }),
    type: projectItemType("type").notNull(),
    title: text("title").notNull(),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("project_item_parent_position_idx").on(
      table.projectId,
      table.parentId,
      table.position,
      table.id,
    ),
    index("project_item_project_updated_idx").on(table.projectId, table.updatedAt, table.id),
  ],
);

export const document = pgTable(
  "document",
  {
    id: text("id")
      .primaryKey()
      .references(() => projectItem.id, { onDelete: "cascade" }),
    content: jsonb("content")
      .$type<unknown[]>()
      .default(
        sql`'[{"id":"initial","type":"paragraph","props":{},"content":[],"children":[]}]'::jsonb`,
      )
      .notNull(),
    contentSchemaVersion: integer("content_schema_version").default(1).notNull(),
    contentByteSize: bigint("content_byte_size", { mode: "number" }).default(0).notNull(),
    revision: integer("revision").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("document_updated_idx").on(table.updatedAt, table.id)],
);

export const userStorage = pgTable("user_storage", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  usedBytes: bigint("used_bytes", { mode: "number" }).default(0).notNull(),
  reservedBytes: bigint("reserved_bytes", { mode: "number" }).default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const documentImport = pgTable(
  "document_import",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    parentId: text("parent_id").references(() => projectItem.id, { onDelete: "set null" }),
    documentId: text("document_id").notNull().unique(),
    originalName: text("original_name").notNull(),
    declaredMimeType: text("declared_mime_type").notNull(),
    detectedMimeType: text("detected_mime_type"),
    inputByteSize: bigint("input_byte_size", { mode: "number" }).notNull(),
    inputObjectKey: text("input_object_key"),
    status: documentImportStatus("status").default("uploading").notNull(),
    phase: documentImportPhase("phase"),
    progressCurrent: integer("progress_current"),
    progressTotal: integer("progress_total"),
    attempts: integer("attempts").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(3).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
    leaseOwner: text("lease_owner"),
    leasedUntil: timestamp("leased_until", { withTimezone: true }),
    cancelRequestedAt: timestamp("cancel_requested_at", { withTimezone: true }),
    errorCode: text("error_code"),
    warnings: jsonb("warnings")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    resultDocumentId: text("result_document_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("document_import_claim_idx").on(table.status, table.availableAt, table.createdAt),
    index("document_import_user_status_idx").on(table.userId, table.status, table.createdAt),
    index("document_import_user_created_idx").on(table.userId, table.createdAt),
    index("document_import_project_idx").on(table.projectId, table.createdAt),
  ],
);

export const storageObjectDeletion = pgTable(
  "storage_object_deletion",
  {
    objectKey: text("object_key").primaryKey(),
    attempts: integer("attempts").default(0).notNull(),
    availableAt: timestamp("available_at", { withTimezone: true }).defaultNow().notNull(),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("storage_object_deletion_available_idx").on(table.availableAt, table.createdAt),
  ],
);

export const asset = pgTable(
  "asset",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => project.id, { onDelete: "cascade" }),
    documentId: text("document_id").references(() => document.id, { onDelete: "cascade" }),
    flashcardId: text("flashcard_id").references(() => flashcard.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    attachedAt: timestamp("attached_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("asset_object_key_unique").on(table.objectKey),
    index("asset_document_idx").on(table.documentId, table.createdAt),
    index("asset_flashcard_idx").on(table.flashcardId, table.createdAt),
    index("asset_user_idx").on(table.userId, table.createdAt),
    index("asset_unattached_idx").on(table.attachedAt, table.createdAt),
    check(
      "asset_target_check",
      sql`(
        (${table.projectId} is null and ${table.documentId} is null and ${table.flashcardId} is null)
        or (${table.projectId} is not null and ${table.documentId} is not null and ${table.flashcardId} is null)
        or (${table.projectId} is null and ${table.documentId} is null and ${table.flashcardId} is not null)
      )`,
    ),
  ],
);
