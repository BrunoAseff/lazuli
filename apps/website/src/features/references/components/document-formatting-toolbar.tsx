import {
  FormattingToolbar,
  getFormattingToolbarItems,
  useBlockNoteEditor,
  useComponentsContext,
  type FormattingToolbarProps,
} from "@blocknote/react";
import { AI_SELECTION_MAX_TEXT_LENGTH, AI_SELECTION_MIN_TEXT_LENGTH } from "@lazuli/shared";
import { LinkSimpleIcon } from "@phosphor-icons/react/LinkSimple";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { FlashcardDomainIcon, QuizDomainIcon } from "@/components/domain-icons.ts";
import { documentSchema } from "@/features/documents/editor/document-schema.tsx";

export type DocumentMaterialAction = {
  anchorId: string;
  anchorCreated: boolean;
  kind: "flashcard" | "quizQuestion";
  selectedText: string;
};

export type DocumentAiAction = Omit<DocumentMaterialAction, "kind"> & {
  sourceScope: "image" | "selection";
  sourceBlockIds: string[];
};

type ReferenceSelectionEditor = {
  addStyles: (styles: { sourceAnchor: string }) => void;
  getActiveStyles: () => Record<string, boolean | string>;
  getSelectedText: () => string;
  getSelection: () => { blocks: Array<{ id: string; type: string }> } | undefined;
  getTextCursorPosition?: () => { block: { id: string; type: string } };
};

export const getDocumentReferenceSelection = (editor: ReferenceSelectionEditor) => {
  const selectedText = editor.getSelectedText().trim();
  const selectedBlocks = editor.getSelection()?.blocks ?? [];
  const cursorBlock = selectedBlocks.length ? null : editor.getTextCursorPosition?.().block;
  const blocks = selectedBlocks.length ? selectedBlocks : cursorBlock ? [cursorBlock] : [];
  const sourceBlockIds = [...new Set(blocks.map(({ id }) => id))];
  if (selectedText) return { selectedText, imageBlockId: null, sourceBlockIds };
  const image = blocks.length === 1 && blocks[0]?.type === "image" ? blocks[0] : null;
  return image
    ? { selectedText: "Imagem selecionada", imageBlockId: image.id, sourceBlockIds: [image.id] }
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
