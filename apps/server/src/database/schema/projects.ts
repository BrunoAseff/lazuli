import {
  boolean,
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { asset } from "./documents.ts";

import { user } from "./auth.ts";

export const project = pgTable(
  "project",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    coverKey: text("cover_key"),
    coverAssetId: text("cover_asset_id").references((): AnyPgColumn => asset.id, {
      onDelete: "set null",
    }),
    coverThumbnailAssetId: text("cover_thumbnail_asset_id").references(
      (): AnyPgColumn => asset.id,
      { onDelete: "set null" },
    ),
    // The uploaded image before cropping, kept so the framing can be adjusted later.
    coverSourceAssetId: text("cover_source_asset_id").references((): AnyPgColumn => asset.id, {
      onDelete: "set null",
    }),
    coverCropX: doublePrecision("cover_crop_x"),
    coverCropY: doublePrecision("cover_crop_y"),
    coverCropZoom: doublePrecision("cover_crop_zoom"),
    quotaExempt: boolean("quota_exempt").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("project_user_updated_id_idx").on(table.userId, table.updatedAt, table.id),
    index("project_user_quota_idx").on(table.userId, table.quotaExempt),
  ],
);
