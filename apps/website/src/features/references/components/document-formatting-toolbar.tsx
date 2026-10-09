import {
  FormattingToolbar,
  getFormattingToolbarItems,
  useBlockNoteEditor,
  useComponentsContext,
  type FormattingToolbarProps,
} from "@blocknote/react";
import {
  AI_SELECTION_MAX_TEXT_LENGTH,
  AI_SELECTION_MIN_TEXT_LENGTH,
  getDocumentBlockText,
  type DocumentBlock,
  type DocumentInlineContent,
} from "@lazuli/shared";
import { LinkSimpleIcon } from "@phosphor-icons/react/LinkSimple";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { FlashcardDomainIcon, QuizDomainIcon } from "@/components/domain-icons.ts";
import type { AiSelectionPreviewPart } from "@/features/ai/ai-selection-types.ts";
import { documentSchema } from "@/features/documents/editor/document-schema.tsx";

export type DocumentMaterialAction = {
  anchorId: string;
  anchorCreated: boolean;
  kind: "flashcard" | "quizQuestion";
  selectedText: string;
};

export type DocumentAiAction = Omit<DocumentMaterialAction, "kind"> & {
  selectedPreview: string;
  selectedPreviewParts: AiSelectionPreviewPart[];
  sourceScope: "image" | "selection";
  sourceBlockIds: string[];
};

type ReferenceSelectionEditor = {
  addStyles: (styles: { sourceAnchor: string }) => void;
  document: unknown[];
  getActiveStyles: () => Record<string, boolean | string>;
  getSelectedText: () => string;
  getSelection: () => { blocks: unknown[] } | undefined;
  getTextCursorPosition?: () => { block: unknown };
};

const indexDocumentBlocks = (blocks: DocumentBlock[]) => {
  const indexed = new Map<string, DocumentBlock>();
  const pending = [...blocks];
  while (pending.length) {
    const block = pending.shift()!;
    indexed.set(block.id, block);
    if (block.children?.length) pending.unshift(...block.children);
  }
  return indexed;
};

const resolveCanonicalBlocks = (editor: ReferenceSelectionEditor, blocks: DocumentBlock[]) => {
  const indexed = indexDocumentBlocks(editor.document as DocumentBlock[]);
  return blocks.map((block) => indexed.get(block.id) ?? block);
};

const flattenDocumentBlocks = (blocks: DocumentBlock[]): DocumentBlock[] =>
  blocks.flatMap((block) => [block, ...flattenDocumentBlocks(block.children ?? [])]);

const getSelectedBlockIdsFromDom = () => {
  if (typeof window === "undefined") return [];
  const selection = window.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed) return [];
  const range = selection.getRangeAt(0);
  const selectionElement =
    selection.anchorNode instanceof Element
      ? selection.anchorNode
      : selection.anchorNode?.parentElement;
  const editorRoot = selectionElement?.closest(".lazuli-document-editor");
  if (!editorRoot) return [];

  return Array.from(editorRoot.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]"))
    .filter((element) => {
      try {
        return range.intersectsNode(element);
      } catch {
        return false;
      }
    })
    .map(({ dataset }) => dataset.id)
    .filter((id): id is string => Boolean(id));
};

const resolveSelectedBlocks = (editor: ReferenceSelectionEditor) => {
  const documentBlocks = flattenDocumentBlocks(editor.document as DocumentBlock[]);
  const apiIds = new Set(
    ((editor.getSelection()?.blocks ?? []) as DocumentBlock[]).map(({ id }) => id),
  );
  const domIds = new Set(getSelectedBlockIdsFromDom());
  const selected = documentBlocks.filter(({ id }) => apiIds.has(id) || domIds.has(id));
  return selected.length
    ? selected
    : resolveCanonicalBlocks(editor, (editor.getSelection()?.blocks ?? []) as DocumentBlock[]);
};

const normalizePreviewText = (value: string) => value.replace(/\s+/g, " ").trim();

export const resolveDocumentSelectionText = (
  editorText: string,
  browserText: string | null | undefined,
  blocks: DocumentBlock[],
) => {
  const normalizedEditorText = normalizePreviewText(editorText);
  const normalizedBrowserText = normalizePreviewText(browserText ?? "");
  const includesTable = blocks.some(({ type }) => type === "table");
  const structuredText = includesTable
    ? normalizePreviewText(blocks.map(getDocumentBlockText).filter(Boolean).join(" "))
    : "";

  if (!includesTable) return normalizedEditorText;
  return [normalizedEditorText, normalizedBrowserText, structuredText].reduce((longest, value) =>
    value.length > longest.length ? value : longest,
  );
};

type SelectionPreviewUnit = {
  cells?: Array<{ content: DocumentInlineContent[]; text: string }>;
  content?: DocumentInlineContent[];
  tableRow?: string;
  text: string;
  type: DocumentBlock["type"];
};

const getInlineText = (content: DocumentInlineContent[]) =>
  content
    .flatMap((item) =>
      item.type === "text" ? [item.text] : [item.content.map(({ text }) => text).join("")],
    )
    .join("");

const getSelectionPreviewUnits = (blocks: DocumentBlock[]): SelectionPreviewUnit[] =>
  blocks.flatMap((block) => {
    if (block.content && !Array.isArray(block.content)) {
      return block.content.rows.flatMap(({ cells }, tableRow) =>
        cells.map((cell) => {
          const content = Array.isArray(cell) ? cell : cell.content;
          return {
            content,
            tableRow: `${block.id}:${tableRow}`,
            text: normalizePreviewText(getInlineText(content)),
            type: block.type,
          };
        }),
      );
    }
    return [
      {
        content: Array.isArray(block.content) ? block.content : undefined,
        text: getDocumentBlockText(block),
        type: block.type,
      },
    ];
  });

const groupSelectionPreviewUnits = (units: SelectionPreviewUnit[]) =>
  units.reduce<SelectionPreviewUnit[]>((lines, unit) => {
    const previous = lines.at(-1);
    if (
      unit.type === "table" &&
      previous?.type === "table" &&
      previous.tableRow === unit.tableRow
    ) {
      previous.text += ` | ${unit.text}`;
      previous.cells?.push({
        content: unit.content ?? [{ styles: {}, text: unit.text, type: "text" as const }],
        text: unit.text,
      });
    } else {
      lines.push({
        ...unit,
        cells:
          unit.type === "table"
            ? [
                {
                  content: unit.content ?? [{ styles: {}, text: unit.text, type: "text" as const }],
                  text: unit.text,
                },
              ]
            : undefined,
      });
    }
    return lines;
  }, []);

const getSelectedBlockLines = (selectedText: string, blocks: DocumentBlock[]) => {
  const units = getSelectionPreviewUnits(blocks);
  const normalizedSelection = normalizePreviewText(selectedText);
  if (!normalizedSelection || units.every(({ text }) => !text)) return null;

  const findSelection = (separator: string) => {
    const ranges: Array<{ end: number; start: number }> = [];
    let cursor = 0;
    const documentText = units
      .map(({ text }, index) => {
        if (index) cursor += separator.length;
        const start = cursor;
        cursor += text.length;
        ranges.push({ end: cursor, start });
        return text;
      })
      .join(separator);
    const selectionStart = documentText.indexOf(normalizedSelection);
    if (selectionStart < 0) return null;
    const selectionEnd = selectionStart + normalizedSelection.length;
    const selectedUnits = ranges.flatMap(({ end, start }, index) => {
      const overlapStart = Math.max(start, selectionStart);
      const overlapEnd = Math.min(end, selectionEnd);
      if (overlapStart >= overlapEnd) return [];
      return [
        {
          ...units[index]!,
          content: overlapStart === start && overlapEnd === end ? units[index]!.content : undefined,
          text: units[index]!.text.slice(overlapStart - start, overlapEnd - start).trim(),
        },
      ];
    });
    return groupSelectionPreviewUnits(selectedUnits);
  };

  return findSelection("") ?? findSelection(" ");
};

const getDocumentSelectionPreviewLines = (
  selectedText: string,
  blocks: DocumentBlock[],
  browserText?: string | null,
): SelectionPreviewUnit[] => {
  const selectedLines = getSelectedBlockLines(selectedText, blocks);
  const structuredFallback =
    blocks.length > 1 || blocks.some(({ type }) => type === "table")
      ? groupSelectionPreviewUnits(
          getSelectionPreviewUnits(blocks).filter(
            ({ cells, text }) => Boolean(text) || Boolean(cells?.length),
          ),
        )
      : [];
  const browserSelectionMatches =
    browserText && normalizePreviewText(browserText) === normalizePreviewText(selectedText);
  const fallbackLines = (browserSelectionMatches ? browserText : selectedText)
    .trim()
    .replace(/\n{3,}/g, "\n\n")
    .split(/\n/);
  const fallbackTypesMatch = fallbackLines.length === blocks.length;
  return selectedLines?.length
    ? selectedLines
    : structuredFallback.length
      ? structuredFallback
      : fallbackLines.map((text, index) => ({
          content: [{ styles: {}, text, type: "text" as const }],
          text,
          type: fallbackTypesMatch ? (blocks[index]?.type ?? "paragraph") : "paragraph",
        }));
};

const formatSelectionPreviewLines = (lines: SelectionPreviewUnit[]) => {
  let numberedItem = 0;
  return lines.map(({ text, type }) => {
    if (type === "bulletListItem") return `• ${text}`;
    if (type === "numberedListItem") return `${(numberedItem += 1)}. ${text}`;
    if (type === "checkListItem") return `☐ ${text}`;
    if (type === "quote") return `> ${text}`;
    numberedItem = 0;
    return text;
  });
};

export const formatDocumentSelectionPreview = (
  selectedText: string,
  blocks: DocumentBlock[],
  browserText?: string | null,
) => {
  const lines = getDocumentSelectionPreviewLines(selectedText, blocks, browserText);
  return formatSelectionPreviewLines(lines).join("\n");
};

export const getDocumentSelectionPreviewParts = (
  selectedText: string,
  blocks: DocumentBlock[],
  browserText?: string | null,
): AiSelectionPreviewPart[] => {
  const lines = getDocumentSelectionPreviewLines(selectedText, blocks, browserText);
  const formattedLines = formatSelectionPreviewLines(lines);
  return lines.reduce<AiSelectionPreviewPart[]>((parts, line, index) => {
    if (line.type === "table" && line.cells) {
      const previous = parts.at(-1);
      if (previous?.kind === "table") previous.rows.push(line.cells);
      else parts.push({ kind: "table", rows: [line.cells] });
    } else {
      parts.push({
        blockType: line.type,
        content: line.content ?? [{ styles: {}, text: line.text, type: "text" }],
        kind: "text",
        text: formattedLines[index]!,
      });
    }
    return parts;
  }, []);
};

export const getDocumentReferenceSelection = (editor: ReferenceSelectionEditor) => {
  const editorSelectedText = editor.getSelectedText().trim();
  const selectedBlocks = resolveSelectedBlocks(editor);
  const cursorBlock = selectedBlocks.length
    ? null
    : resolveCanonicalBlocks(
        editor,
        [editor.getTextCursorPosition?.().block as DocumentBlock | undefined].filter(
          (block): block is DocumentBlock => Boolean(block),
        ),
      )[0];
  const blocks = selectedBlocks.length ? selectedBlocks : cursorBlock ? [cursorBlock] : [];
  const sourceBlockIds = [...new Set(blocks.map(({ id }) => id))];
  const browserSelection = typeof window === "undefined" ? "" : window.getSelection()?.toString();
  const selectedText = resolveDocumentSelectionText(editorSelectedText, browserSelection, blocks);
  if (selectedText) {
    const selectedPreview = formatDocumentSelectionPreview(selectedText, blocks, browserSelection);
    const selectedPreviewParts = getDocumentSelectionPreviewParts(
      selectedText,
      blocks,
      browserSelection,
    );
    return {
      selectedPreview,
      selectedPreviewParts,
      selectedText,
      imageBlockId: null,
      sourceBlockIds,
    };
  }
  const image = blocks.length === 1 && blocks[0]?.type === "image" ? blocks[0] : null;
  return image
    ? {
        selectedPreview: "Imagem selecionada",
        selectedPreviewParts: [
          {
            blockType: "paragraph" as const,
            content: [{ styles: {}, text: "Imagem selecionada", type: "text" as const }],
            kind: "text" as const,
            text: "Imagem selecionada",
          },
        ],
        selectedText: "Imagem selecionada",
        imageBlockId: image.id,
        sourceBlockIds: [image.id],
      }
    : null;
};

export const createDocumentFormattingToolbar = (
  onCreate: (action: DocumentMaterialAction) => void,
  onLink: (action: Omit<DocumentMaterialAction, "kind">) => void,
  onGenerate: (action: DocumentAiAction) => void,
  adjustment?: { anchorId: string },
) => {
  const DocumentFormattingToolbar = (props: FormattingToolbarProps) => {
    const editor = useBlockNoteEditor(documentSchema);
    const components = useComponentsContext();
    if (!components) return null;
    // File-block toolbars may clear the editor selection on pointer down. Capture
    // the source while the toolbar is rendered so every custom action uses the
    // image/text that actually opened it.
    const renderedSelection = getDocumentReferenceSelection(editor);

    const getAnchorId = (imageBlockId: string | null) => {
      if (imageBlockId) return { anchorId: imageBlockId, anchorCreated: false };
      const active = editor.getActiveStyles().sourceAnchor;
      if (typeof active === "string" && active) return { anchorId: active, anchorCreated: false };
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const anchorElementFor = (node: Node | null | undefined) =>
        node instanceof Node
          ? node.parentElement?.closest<HTMLElement>(".lazuli-source-anchor[data-anchor-id]")
          : null;
      const startAnchor = anchorElementFor(selection?.anchorNode);
      const endAnchor = anchorElementFor(selection?.focusNode);
      if (startAnchor && endAnchor && startAnchor.dataset.anchorId === endAnchor.dataset.anchorId)
        return { anchorId: startAnchor.dataset.anchorId!, anchorCreated: false };
      const containsAnchor = range?.cloneContents().querySelector?.(".lazuli-source-anchor");
      if (startAnchor || endAnchor || containsAnchor) {
        toast.error(
          "A seleção sobrepõe uma referência existente. Selecione somente o trecho já vinculado ou uma área sem referência.",
        );
        return null;
      }
      const anchorId = crypto.randomUUID();
      editor.addStyles({ sourceAnchor: anchorId });
      return { anchorId, anchorCreated: true };
    };

    const create = (kind: DocumentMaterialAction["kind"]) => {
      const selection = renderedSelection ?? getDocumentReferenceSelection(editor);
      if (!selection) return;
      const anchor = getAnchorId(selection.imageBlockId);
      if (!anchor) return;
      onCreate({ ...anchor, kind, selectedText: selection.selectedText });
    };
    const link = () => {
      const selection = renderedSelection ?? getDocumentReferenceSelection(editor);
      if (!selection) return;
      const anchor = getAnchorId(selection.imageBlockId);
      if (!anchor) return;
      onLink({ ...anchor, selectedText: selection.selectedText });
    };
    const generate = () => {
      const selection = renderedSelection ?? getDocumentReferenceSelection(editor);
      if (!selection) return;
      if (!selection.imageBlockId && selection.selectedText.length < AI_SELECTION_MIN_TEXT_LENGTH) {
        toast.error("Selecione um trecho um pouco maior para gerar materiais.");
        return;
      }
      if (selection.selectedText.length > AI_SELECTION_MAX_TEXT_LENGTH) {
        toast.error("O trecho selecionado é muito grande. Reduza a seleção e tente novamente.");
        return;
      }
      if (!selection.sourceBlockIds.length) {
        toast.error("Não foi possível identificar a origem do trecho. Selecione-o novamente.");
        return;
      }
      const anchor = getAnchorId(selection.imageBlockId);
      if (!anchor) return;
      onGenerate({
        ...anchor,
        selectedPreview: selection.selectedPreview,
        selectedPreviewParts: selection.selectedPreviewParts,
        selectedText: selection.selectedText,
        sourceScope: selection.imageBlockId ? "image" : "selection",
        sourceBlockIds: selection.sourceBlockIds,
      });
    };

    return (
      <FormattingToolbar {...props}>
        {getFormattingToolbarItems(props.blockTypeSelectItems)}
        {!adjustment && (
          <>
            <span className="contents" onMouseDown={(event) => event.preventDefault()}>
              <components.FormattingToolbar.Button
                icon={<FlashcardDomainIcon className="size-4" weight="duotone" />}
                label="Criar flashcard"
                mainTooltip="Criar flashcard deste trecho"
                onClick={() => create("flashcard")}
              />
            </span>
            <span className="contents" onMouseDown={(event) => event.preventDefault()}>
              <components.FormattingToolbar.Button
                icon={<QuizDomainIcon className="size-4" weight="duotone" />}
                label="Criar questão"
                mainTooltip="Criar questão deste trecho"
                onClick={() => create("quizQuestion")}
              />
            </span>
            <span className="contents" onMouseDown={(event) => event.preventDefault()}>
              <components.FormattingToolbar.Button
                icon={<LinkSimpleIcon className="size-4" weight="duotone" />}
                label="Vincular"
                mainTooltip="Vincular a um material existente"
                onClick={link}
              />
            </span>
            <Button
              className="h-8 px-3"
              onClick={generate}
              onMouseDown={(event) => event.preventDefault()}
              size="sm"
              type="button"
            >
              Gerar com IA
            </Button>
          </>
        )}
      </FormattingToolbar>
    );
  };
  return DocumentFormattingToolbar;
};
