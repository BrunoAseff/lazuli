import {
  FormattingToolbar,
  getFormattingToolbarItems,
  useBlockNoteEditor,
  useComponentsContext,
  type FormattingToolbarProps,
} from "@blocknote/react";
import { Layers3Icon, Link2Icon, SquareCheckBigIcon } from "lucide-react";
import { toast } from "sonner";

import { documentSchema } from "@/features/documents/editor/document-schema.tsx";

export type DocumentMaterialAction = {
  anchorId: string;
  anchorCreated: boolean;
  kind: "flashcard" | "quizQuestion";
  selectedText: string;
};

type ReferenceSelectionEditor = {
  addStyles: (styles: { sourceAnchor: string }) => void;
  getActiveStyles: () => Record<string, boolean | string>;
  getSelectedText: () => string;
  getSelection: () => { blocks: Array<{ id: string; type: string }> } | undefined;
};

export const getDocumentReferenceSelection = (editor: ReferenceSelectionEditor) => {
  const selectedText = editor.getSelectedText().trim();
  if (selectedText) return { selectedText, imageBlockId: null };
  const blocks = editor.getSelection()?.blocks ?? [];
  const image = blocks.length === 1 && blocks[0]?.type === "image" ? blocks[0] : null;
  return image ? { selectedText: "Imagem selecionada", imageBlockId: image.id } : null;
};

export const createDocumentFormattingToolbar = (
  onCreate: (action: DocumentMaterialAction) => void,
  onLink: (action: Omit<DocumentMaterialAction, "kind">) => void,
  adjustment?: { anchorId: string },
) => {
  const DocumentFormattingToolbar = (props: FormattingToolbarProps) => {
    const editor = useBlockNoteEditor(documentSchema);
    const components = useComponentsContext();
    if (!components) return null;

    const getAnchorId = (imageBlockId: string | null) => {
      if (imageBlockId) return { anchorId: imageBlockId, anchorCreated: false };
      const active = editor.getActiveStyles().sourceAnchor;
      if (typeof active === "string" && active) return { anchorId: active, anchorCreated: false };
      const selection = window.getSelection();
      const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const startsInsideAnchor =
        selection?.anchorNode instanceof Node &&
        (selection.anchorNode.parentElement?.closest(".lazuli-source-anchor") ?? null);
      const containsAnchor = range?.cloneContents().querySelector?.(".lazuli-source-anchor");
      if (startsInsideAnchor || containsAnchor) {
        toast.error("A seleção cruza uma referência existente. Selecione um único trecho.");
        return null;
      }
      const anchorId = crypto.randomUUID();
      editor.addStyles({ sourceAnchor: anchorId });
      return { anchorId, anchorCreated: true };
    };

    const create = (kind: DocumentMaterialAction["kind"]) => {
      const selection = getDocumentReferenceSelection(editor);
      if (!selection) return;
      const anchor = getAnchorId(selection.imageBlockId);
      if (!anchor) return;
      onCreate({ ...anchor, kind, selectedText: selection.selectedText });
    };
    const link = () => {
      const selection = getDocumentReferenceSelection(editor);
      if (!selection) return;
      const anchor = getAnchorId(selection.imageBlockId);
      if (!anchor) return;
      onLink({ ...anchor, selectedText: selection.selectedText });
    };

    return (
      <FormattingToolbar {...props}>
        {getFormattingToolbarItems(props.blockTypeSelectItems)}
        {!adjustment && (
          <>
            <components.FormattingToolbar.Button
              icon={<Layers3Icon className="size-4" />}
              label="Criar flashcard"
              mainTooltip="Criar flashcard deste trecho"
              onClick={() => create("flashcard")}
            />
            <components.FormattingToolbar.Button
              icon={<Link2Icon className="size-4" />}
              label="Vincular"
              mainTooltip="Vincular a um material existente"
              onClick={link}
            />
            <components.FormattingToolbar.Button
              icon={<SquareCheckBigIcon className="size-4" />}
              label="Criar questão"
              mainTooltip="Criar questão deste trecho"
              onClick={() => create("quizQuestion")}
            />
          </>
        )}
      </FormattingToolbar>
    );
  };
  return DocumentFormattingToolbar;
};
