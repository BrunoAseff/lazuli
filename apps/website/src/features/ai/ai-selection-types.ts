import type { DocumentBlock, DocumentInlineContent } from "@lazuli/shared";

export type AiSelectionPreviewCell = {
  content: DocumentInlineContent[];
  text: string;
};

export type AiSelectionPreviewPart =
  | { kind: "table"; rows: AiSelectionPreviewCell[][] }
  | {
      blockType: DocumentBlock["type"];
      content: DocumentInlineContent[];
      kind: "text";
      text: string;
    };

export type AiSelectionAction = {
  anchorId: string | null;
  anchorCreated: boolean;
  selectedPreview?: string;
  selectedPreviewParts?: AiSelectionPreviewPart[];
  selectedText: string;
  sourceScope: "document" | "image" | "selection";
  sourceBlockIds: string[];
};
