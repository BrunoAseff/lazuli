import { sql } from "drizzle-orm";
import {
  bigint,
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
import { project } from "./projects.ts";

export const projectItemType = pgEnum("project_item_type", ["folder", "document"]);

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
    revision: integer("revision").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("document_updated_idx").on(table.updatedAt, table.id)],
);

export const asset = pgTable(
  "asset",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    documentId: text("document_id")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    objectKey: text("object_key").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    byteSize: bigint("byte_size", { mode: "number" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("asset_object_key_unique").on(table.objectKey),
    index("asset_document_idx").on(table.documentId, table.createdAt),
    index("asset_user_idx").on(table.userId, table.createdAt),
  ],
);
