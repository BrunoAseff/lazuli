import { z } from "zod";

import { projectIdSchema } from "../projects/project-contracts.ts";
import { sourceAnchorIdSchema } from "./source-anchor.ts";

export const DOCUMENT_TITLE_MAX_LENGTH = 100;
export const DOCUMENT_MAX_BLOCKS = 10_000;
export const DOCUMENT_MAX_DEPTH = 20;
export const DOCUMENT_MAX_CONTENT_BYTES = 5 * 1024 * 1024;
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_IMPORT_MARKDOWN_MAX_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_IMPORT_BINARY_MAX_BYTES = 25 * 1024 * 1024;
export const DOCUMENT_IMPORT_MAX_ACTIVE = 5;
export const DOCUMENT_IMPORT_RATE_LIMIT = 20;
export const DOCUMENT_IMPORT_RATE_WINDOW_MS = 10 * 60 * 1_000;
export const DOCUMENT_IMPORT_MAX_PDF_PAGES = 500;
export const STORAGE_BASIC_LIMIT_BYTES = 500 * 1024 * 1024;

export const projectItemIdSchema = z.uuid();
export const projectItemTypeSchema = z.enum(["folder", "document"]);
export const normalizeProjectItemTitle = (title: string) => title.trim().replace(/\s+/g, " ");
export const projectItemTitleSchema = z
  .string()
  .trim()
  .min(1, "Informe um nome.")
  .max(DOCUMENT_TITLE_MAX_LENGTH, "O nome deve ter no máximo 100 caracteres.")
  .transform(normalizeProjectItemTitle);

const jsonPrimitiveSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const stylesSchema = z.record(z.string(), jsonPrimitiveSchema);
const textContentSchema = z
  .object({
    type: z.literal("text"),
    text: z.string(),
    styles: stylesSchema,
  })
  .superRefine(({ styles }, context) => {
    if (!("sourceAnchor" in styles)) return;
    if (!sourceAnchorIdSchema.safeParse(styles.sourceAnchor).success)
      context.addIssue({ code: "custom", message: "A referência do texto é inválida." });
  });
const hasControlCharacter = (value: string) =>
  Array.from(value).some((character) => character.charCodeAt(0) < 32);
const safeHrefSchema = z
  .string()
  .max(2_048)
  .refine(
    (value) =>
      !hasControlCharacter(value) &&
      (/^(?:https?:\/\/|mailto:)/i.test(value) || /^(?:\/|#)/.test(value)),
    "O link usa um protocolo não permitido.",
  );
const linkContentSchema = z.object({
  type: z.literal("link"),
  href: safeHrefSchema,
  content: z.array(textContentSchema),
});
const inlineContentSchema = z.union([textContentSchema, linkContentSchema]);

export type DocumentBlock = {
  id: string;
  type:
    | "paragraph"
    | "heading"
    | "bulletListItem"
    | "numberedListItem"
    | "checkListItem"
    | "quote"
    | "codeBlock"
    | "divider"
    | "image";
  props?: Record<string, string | number | boolean | null>;
  content?: Array<z.infer<typeof inlineContentSchema>>;
  children?: DocumentBlock[];
};

const allowedBlockTypes = [
  "paragraph",
  "heading",
  "bulletListItem",
  "numberedListItem",
  "checkListItem",
  "quote",
  "codeBlock",
  "divider",
  "image",
] as const;

export const documentBlockSchema: z.ZodType<DocumentBlock> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(128),
    type: z.enum(allowedBlockTypes),
    props: z.record(z.string(), jsonPrimitiveSchema).optional(),
    content: z.array(inlineContentSchema).optional(),
    children: z.array(documentBlockSchema).optional(),
  }),
);

const documentStructureLimitsSchema = z.unknown().superRefine((value, context) => {
  if (!Array.isArray(value)) return;

  const pending: Array<{ blocks: unknown[]; depth: number }> = [{ blocks: value, depth: 1 }];
  let count = 0;
  while (pending.length) {
    const current = pending.pop()!;
    if (current.depth > DOCUMENT_MAX_DEPTH) {
      context.addIssue({ code: "custom", message: "O documento excede o limite de níveis." });
      return;
    }
    count += current.blocks.length;
    if (count > DOCUMENT_MAX_BLOCKS) {
      context.addIssue({ code: "custom", message: "O documento excede o limite de blocos." });
      return;
    }
    for (const block of current.blocks) {
      if (!block || typeof block !== "object") continue;
      const children = (block as { children?: unknown }).children;
      if (Array.isArray(children)) pending.push({ blocks: children, depth: current.depth + 1 });
    }
  }
});

export const documentContentSchema = documentStructureLimitsSchema
  .pipe(z.array(documentBlockSchema).min(1))
  .superRefine((blocks, context) => {
    const ids = new Set<string>();
    const visit = (items: DocumentBlock[]) => {
      for (const block of items) {
        if (ids.has(block.id))
          context.addIssue({
            code: "custom",
            message: "Os blocos devem ter identificadores únicos.",
          });
        ids.add(block.id);
        if (block.type === "image") {
          const url = block.props?.url;
          if (
            typeof url === "string" &&
            url !== "" &&
            !/^\/api\/assets\/[0-9a-f-]{36}\/content$/i.test(url)
          ) {
            context.addIssue({ code: "custom", message: "A imagem deve usar um asset do Lazúli." });
          }
        }
        if (block.children) visit(block.children);
      }
    };
    visit(blocks);
  });

export const projectTreeItemSchema = z.object({
  id: projectItemIdSchema,
  projectId: projectIdSchema,
  parentId: projectItemIdSchema.nullable(),
  type: projectItemTypeSchema,
  title: z.string(),
  position: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export const projectTreeResponseSchema = z.object({ items: z.array(projectTreeItemSchema) });
export const createProjectItemSchema = z.object({
  id: projectItemIdSchema,
  type: projectItemTypeSchema,
  title: projectItemTitleSchema,
  parentId: projectItemIdSchema.nullable().default(null),
});
export const updateProjectItemSchema = z
  .object({
    title: projectItemTitleSchema.optional(),
    parentId: projectItemIdSchema.nullable().optional(),
  })
  .refine(({ parentId, title }) => parentId !== undefined || title !== undefined, {
    message: "Informe ao menos uma alteração.",
  });
export const documentResponseSchema = z.object({
  item: projectTreeItemSchema.extend({ type: z.literal("document") }),
  content: documentContentSchema,
  contentSchemaVersion: z.number().int().positive(),
  revision: z.number().int().positive(),
});
export const saveDocumentContentSchema = z.object({
  content: documentContentSchema,
  expectedRevision: z.number().int().positive(),
});
export const importDocumentImageSchema = z.object({
  url: z
    .url("Informe uma URL válida.")
    .max(2_048)
    .refine((value) => /^https?:\/\//i.test(value), "A imagem deve usar HTTP ou HTTPS."),
});
export const assetResponseSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  mimeType: z.string(),
  byteSize: z.number().int().positive(),
});

export const DOCUMENT_IMPORT_ACTIVE_STATUSES = [
  "uploading",
  "queued",
  "processing",
  "finalizing",
] as const;
export const documentImportStatusSchema = z.enum([
  ...DOCUMENT_IMPORT_ACTIVE_STATUSES,
  "completed",
  "failed",
  "canceled",
]);
export const documentImportPhaseSchema = z.enum([
  "validating",
  "extracting",
  "converting",
  "finalizing",
]);
export const documentImportMimeTypeSchema = z.enum([
  "text/markdown",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/pdf",
]);
export const createDocumentImportSchema = z
  .object({
    id: z.uuid(),
    documentId: z.uuid(),
    parentId: projectItemIdSchema.nullable().default(null),
    originalName: z.string().trim().min(1).max(255),
    mimeType: documentImportMimeTypeSchema,
    byteSize: z.number().int().positive().max(DOCUMENT_IMPORT_BINARY_MAX_BYTES),
  })
  .refine(
    ({ byteSize, mimeType }) =>
      !["text/markdown", "text/plain"].includes(mimeType) ||
      byteSize <= DOCUMENT_IMPORT_MARKDOWN_MAX_BYTES,
    { message: "Arquivos de texto devem ter no máximo 5 MB.", path: ["byteSize"] },
  );
export const documentImportSchema = z.object({
  id: z.uuid(),
  projectId: projectIdSchema,
  parentId: projectItemIdSchema.nullable(),
  documentId: z.uuid(),
  originalName: z.string(),
  mimeType: z.string(),
  byteSize: z.number().int().nonnegative(),
  status: documentImportStatusSchema,
  phase: documentImportPhaseSchema.nullable(),
  progressCurrent: z.number().int().nonnegative().nullable(),
  progressTotal: z.number().int().positive().nullable(),
  errorCode: z.string().nullable(),
  warnings: z.array(z.string()),
  resultDocumentId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime().nullable(),
});
export const documentImportListSchema = z.object({ imports: z.array(documentImportSchema) });
export const storageUsageSchema = z.object({
  usedBytes: z.number().int().nonnegative(),
  reservedBytes: z.number().int().nonnegative(),
  limitBytes: z.number().int().positive(),
});

export type ProjectTreeItem = z.infer<typeof projectTreeItemSchema>;
export type ProjectTreeResponse = z.infer<typeof projectTreeResponseSchema>;
export type CreateProjectItemInput = z.infer<typeof createProjectItemSchema>;
export type UpdateProjectItemInput = z.infer<typeof updateProjectItemSchema>;
export type DocumentResponse = z.infer<typeof documentResponseSchema>;
export type SaveDocumentContentInput = z.infer<typeof saveDocumentContentSchema>;
export type ImportDocumentImageInput = z.infer<typeof importDocumentImageSchema>;
export type AssetResponse = z.infer<typeof assetResponseSchema>;
export type CreateDocumentImportInput = z.infer<typeof createDocumentImportSchema>;
export type DocumentImport = z.infer<typeof documentImportSchema>;
export type DocumentImportList = z.infer<typeof documentImportListSchema>;
export type DocumentImportStatus = z.infer<typeof documentImportStatusSchema>;
export type StorageUsage = z.infer<typeof storageUsageSchema>;
