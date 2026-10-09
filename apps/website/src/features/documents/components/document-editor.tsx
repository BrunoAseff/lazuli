import {
  normalizeProjectItemTitle,
  referenceTargetSchema,
  removeSourceAnchors,
  AI_DOCUMENT_MAX_BLOCKS,
  AI_DOCUMENT_MAX_TEXT_LENGTH,
  collectDocumentTextBlocks,
  type DocumentBlock,
} from "@lazuli/shared";
import { ArrowLeftIcon } from "@phosphor-icons/react/ArrowLeft";
import { CheckIcon } from "@phosphor-icons/react/Check";
import { FormattingToolbarController, useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useBlocker, useLocation, useNavigate } from "react-router";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  removeAssetByUrl,
  releaseResolvedAssetUrls,
  resolveAssetUrl,
} from "@/features/assets/asset-api.ts";
import { cleanupAssets, collectAssetUrls } from "@/features/assets/rich-content-assets.ts";
import { ApiError } from "@/lib/api-client.ts";
import type { AiSelectionAction } from "@/features/ai/ai-selection-types.ts";
import { AiSelectionGenerationDialog } from "@/features/ai/components/ai-selection-generation-dialog.tsx";
import { updateAiReviewReference } from "@/features/ai/ai-review-session.ts";
import { DocumentMaterialFlow } from "@/features/references/components/document-material-flow.tsx";
import {
  DocumentReferencesButton,
  DocumentReferencesDialog,
} from "@/features/references/components/document-references-dialog.tsx";
import {
  createDocumentFormattingToolbar,
  getDocumentReferenceSelection,
  type DocumentMaterialAction,
} from "@/features/references/components/document-formatting-toolbar.tsx";
import { ExistingMaterialPickerDialog } from "@/features/references/components/existing-material-picker-dialog.tsx";
import { useCreateReferences } from "@/features/references/api/reference-queries.ts";
import { fetchDocument, importDocumentImage, uploadDocumentImage } from "../api/document-api.ts";
import {
  documentKeys,
  useDocument,
  useRenameProjectItem,
  useSaveDocument,
} from "../api/document-queries.ts";
import { DOCUMENT_MESSAGES } from "../document-messages.ts";
import { lazuliBlockNoteDictionary } from "../editor/blocknote-dictionary.ts";
import { documentSchema, type LazuliDocumentBlock } from "../editor/document-schema.tsx";
import { DocumentFind } from "../editor/document-find.tsx";
import {
  ExternalImageImportError,
  importExternalImages,
} from "../editor/import-external-images.ts";
import { LocalizedBlockNoteInput } from "../editor/localized-blocknote-input.tsx";
import { DocumentSaveStatus, type DocumentSaveState } from "./document-save-status.tsx";
import { safeReturnTo } from "../document-navigation.ts";

const blockNoteComponents = { Input: { Input: LocalizedBlockNoteInput } };
const toDocumentBlocks = (blocks: LazuliDocumentBlock) => blocks as unknown as DocumentBlock[];
export const DocumentEditor = ({
  projectId,
  documentId,
  data,
}: {
  projectId: string;
  documentId: string;
  data: NonNullable<ReturnType<typeof useDocument>["data"]>;
}) => {
  const queryClient = useQueryClient();
  const saveDocument = useSaveDocument(projectId, documentId);
  const rename = useRenameProjectItem(projectId);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<DocumentSaveState>("saved");
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [autoSavePaused, setAutoSavePaused] = useState(false);
  const [isPreparingSave, setIsPreparingSave] = useState(false);
  const [imageImportError, setImageImportError] = useState<{
    blockId: string;
    message: string;
    sourceUrl: string;
  } | null>(null);
  const [revision, setRevision] = useState(data.revision);
  const revisionRef = useRef(data.revision);
  const [title, setTitle] = useState(data.item.title);
  const [materialAction, setMaterialAction] = useState<DocumentMaterialAction | null>(null);
  const [aiAction, setAiAction] = useState<AiSelectionAction | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [linkAction, setLinkAction] = useState<Omit<DocumentMaterialAction, "kind"> | null>(null);
  const [activeAnchorId, setActiveAnchorId] = useState<string | null>(null);
  const [documentReferencesOpen, setDocumentReferencesOpen] = useState(false);
  const [wholeDocumentPickerOpen, setWholeDocumentPickerOpen] = useState(false);
  const [adjustingAnchorId, setAdjustingAnchorId] = useState<string | null>(null);
  const [pendingSelectionAvailable, setPendingSelectionAvailable] = useState(false);
  const [pendingLinkConfirmationOpen, setPendingLinkConfirmationOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const createReference = useCreateReferences();
  const pendingTarget = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const parsed = referenceTargetSchema.safeParse({
      type: params.get("referenceTargetType"),
      id: params.get("referenceTargetId"),
    });
    return parsed.success ? parsed.data : null;
  }, [location.search]);
  const referenceReturnTo = useMemo(() => {
    const value = new URLSearchParams(location.search).get("referenceReturnTo");
    return value?.startsWith("/") && !value.startsWith("//") ? value : null;
  }, [location.search]);
  const pendingAiReference = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const operationId = params.get("aiReferenceOperationId");
    const proposalId = params.get("aiReferenceProposalId");
    const kind = params.get("aiReferenceKind");
    const referenceIndex = Number(params.get("aiReferenceIndex"));
    const returnTo = safeReturnTo(params.get("aiReferenceReturnTo"));
    if (
      !operationId ||
      !proposalId ||
      (kind !== "flashcard" && kind !== "quizQuestion") ||
      !Number.isInteger(referenceIndex) ||
      referenceIndex < 0 ||
      !returnTo
    )
      return null;
    return {
      kind: kind as "flashcard" | "quizQuestion",
      operationId,
      proposalId,
      referenceIndex,
      returnTo,
    };
  }, [location.search]);
  const contextualReturnTo = useMemo(
    () => safeReturnTo(new URLSearchParams(location.search).get("returnTo")),
    [location.search],
  );
  useEffect(() => {
    if (aiAction && !pendingAiReference && new URLSearchParams(location.search).get("aiGeneration"))
      setAiDialogOpen(true);
  }, [aiAction, location.search, pendingAiReference]);
  const cleanSnapshot = useRef(JSON.stringify(data.content));
  const savedTitle = useRef(data.item.title);
  const titleDirty = normalizeProjectItemTitle(title) !== savedTitle.current;
  const cleanAssetUrls = useRef(collectAssetUrls(data.content as LazuliDocumentBlock));
  const createdAssetUrls = useRef(new Set<string>());
  const adjustmentSnapshot = useRef<LazuliDocumentBlock | null>(null);
  const adjustingAnchorRef = useRef<string | null>(null);
  const saveInFlight = useRef(false);
  const saveWaiters = useRef<Array<() => void>>([]);
  const retryAttempt = useRef(0);
  const retryTimer = useRef<number | null>(null);
  const saveRef = useRef<(silent?: boolean, expectedRevision?: number) => Promise<boolean>>(
    async () => false,
  );
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const titleElementRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (data.item.title === savedTitle.current) return;
    setTitle((current) => {
      if (current !== savedTitle.current) return current;
      savedTitle.current = data.item.title;
      return data.item.title;
    });
  }, [data.item.title]);
  const editor = useCreateBlockNote(
    {
      schema: documentSchema,
      initialContent: data.content as LazuliDocumentBlock,
      dictionary: lazuliBlockNoteDictionary,
      uploadFile: async (file: File) => {
        const uploaded = await uploadDocumentImage(projectId, documentId, file);
        createdAssetUrls.current.add(uploaded.url);
        return uploaded.url;
      },
      resolveFileUrl: resolveAssetUrl,
    },
    [documentId],
  );
  const openMaterialFlow = useCallback((action: DocumentMaterialAction) => {
    setMaterialAction(action);
  }, []);
  const openAiFlow = useCallback(
    async (action: AiSelectionAction) => {
      setAutoSavePaused(true);
      if (action.anchorCreated && !(await saveRef.current(true))) {
        if (action.anchorId) {
          const next = removeSourceAnchors(
            toDocumentBlocks(editor.document),
            new Set([action.anchorId]),
          ).content as LazuliDocumentBlock;
          editor.replaceBlocks(editor.document, next);
          const snapshot = JSON.stringify(next);
          setDirty(snapshot !== cleanSnapshot.current);
          setSaveState(snapshot === cleanSnapshot.current && !titleDirty ? "saved" : "pending");
        }
        setAutoSavePaused(false);
        toast.error("Não foi possível preparar o trecho para a geração.");
        return;
      }
      setAiAction(action);
      setAiDialogOpen(true);
    },
    [editor, titleDirty],
  );
  const finishAdjustment = useCallback(() => {
    adjustmentSnapshot.current = null;
    adjustingAnchorRef.current = null;
    setAdjustingAnchorId(null);
    setAutoSavePaused(false);
    toast.success("Trecho ajustado.");
  }, []);
  const formattingToolbar = useMemo(
    () =>
      createDocumentFormattingToolbar(
        openMaterialFlow,
        setLinkAction,
        openAiFlow,
        adjustingAnchorId ? { anchorId: adjustingAnchorId } : undefined,
      ),
    [adjustingAnchorId, openAiFlow, openMaterialFlow],
  );
  const selectPendingTarget = async () => {
    if (!pendingTarget) return;
    const selection = getDocumentReferenceSelection(editor);
    if (!selection) {
      toast.error("Selecione um trecho do documento antes de vincular.");
      return;
    }
    const active = selection.imageBlockId ? undefined : editor.getActiveStyles().sourceAnchor;
    const anchorId =
      selection.imageBlockId ??
      (typeof active === "string" && active ? active : crypto.randomUUID());
    const anchorCreated = !selection.imageBlockId && !active;
    if (anchorCreated) editor.addStyles({ sourceAnchor: anchorId });
    try {
      if (!(await saveRef.current(true))) throw new Error("save_failed");
      await createReference.mutateAsync({
        source: { type: "selection", documentId, anchorId },
        targets: [pendingTarget],
      });
      toast.success("Trecho vinculado.");
      if (referenceReturnTo) void navigate(referenceReturnTo, { replace: true });
      else void navigate(-1);
    } catch {
      if (anchorCreated) {
        const next = removeSourceAnchors(toDocumentBlocks(editor.document), new Set([anchorId]))
          .content as LazuliDocumentBlock;
        editor.replaceBlocks(editor.document, next);
      }
      toast.error("Não foi possível vincular o trecho.");
    }
  };
  const selectPendingAiReference = () => {
    if (!pendingAiReference) return;
    const selection = getDocumentReferenceSelection(editor);
    if (!selection || selection.imageBlockId) {
      toast.error("Selecione um trecho de texto antes de salvar.");
      return;
    }
    if (selection.sourceBlockIds.length !== 1) {
      toast.error("Selecione um trecho dentro de um único bloco.");
      return;
    }
    const updated = updateAiReviewReference({
      blockId: selection.sourceBlockIds[0]!,
      kind: pendingAiReference.kind,
      operationId: pendingAiReference.operationId,
      proposalId: pendingAiReference.proposalId,
      quote: selection.selectedText,
      referenceIndex: pendingAiReference.referenceIndex,
    });
    if (!updated) {
      toast.error("Não foi possível atualizar a referência desta proposta.");
      return;
    }
    toast.success("Trecho da referência ajustado.");
    void navigate(pendingAiReference.returnTo, { replace: true });
  };
  const applyAdjustment = () => {
    if (!adjustingAnchorId || !editor.getSelectedText().trim()) {
      toast.error("Selecione o novo trecho antes de salvar.");
      return;
    }
    editor.addStyles({ sourceAnchor: adjustingAnchorId });
    finishAdjustment();
  };
  const cancelAdjustment = () => {
    if (adjustmentSnapshot.current)
      editor.replaceBlocks(editor.document, adjustmentSnapshot.current);
    const restoredSnapshot = JSON.stringify(adjustmentSnapshot.current ?? editor.document);
    adjustmentSnapshot.current = null;
    adjustingAnchorRef.current = null;
    setAdjustingAnchorId(null);
    setDirty(restoredSnapshot !== cleanSnapshot.current);
    setSaveState(restoredSnapshot === cleanSnapshot.current ? "saved" : "pending");
    setAutoSavePaused(false);
  };
  const closeMaterialFlow = (
    removeAnchor: boolean,
    anchorId = materialAction?.anchorId,
    anchorCreated = materialAction?.anchorCreated ?? true,
  ) => {
    if (removeAnchor && anchorId && anchorCreated) {
      const next = removeSourceAnchors(toDocumentBlocks(editor.document), new Set([anchorId]))
        .content as LazuliDocumentBlock;
      editor.replaceBlocks(editor.document, next);
    }
    setMaterialAction(null);
    setLinkAction(null);
  };
  const closeAiFlow = async (removeAnchor: boolean) => {
    let removedTemporaryAnchor = false;
    if (removeAnchor && aiAction?.anchorCreated && aiAction.anchorId) {
      const next = removeSourceAnchors(
        toDocumentBlocks(editor.document),
        new Set([aiAction.anchorId]),
      ).content as LazuliDocumentBlock;
      editor.replaceBlocks(editor.document, next);
      const snapshot = JSON.stringify(next);
      setDirty(snapshot !== cleanSnapshot.current);
      setSaveState(snapshot === cleanSnapshot.current && !titleDirty ? "saved" : "pending");
      removedTemporaryAnchor = true;
    }
    setAiAction(null);
    setAiDialogOpen(false);
    setAutoSavePaused(false);
    if (removedTemporaryAnchor && !(await saveRef.current(true))) {
      toast.error("Não foi possível remover a marcação temporária do trecho.");
    }
  };
  useEffect(() => releaseResolvedAssetUrls, [documentId]);
  useEffect(() => {
    if (!pendingTarget && !pendingAiReference && !adjustingAnchorId) {
      setPendingSelectionAvailable(false);
      return;
    }
    const update = () =>
      setPendingSelectionAvailable(Boolean(getDocumentReferenceSelection(editor)));
    update();
    return editor.onSelectionChange(update);
  }, [adjustingAnchorId, editor, pendingAiReference, pendingTarget]);
  useEffect(() => {
    const anchorId = new URLSearchParams(location.search).get("anchor");
    if (!anchorId) return;
    const timer = window.setTimeout(() => {
      const anchor = editorContainerRef.current?.querySelector<HTMLElement>(
        `.lazuli-source-anchor[data-anchor-id="${CSS.escape(anchorId)}"]`,
      );
      anchor?.scrollIntoView({ behavior: "smooth", block: "center" });
      anchor?.setAttribute("data-reference-target", "true");
      window.setTimeout(() => anchor?.removeAttribute("data-reference-target"), 2_000);
    });
    return () => window.clearTimeout(timer);
  }, [documentId, location.search]);
  useEffect(() => {
    const blockId = new URLSearchParams(location.search).get("block");
    if (!blockId) return;
    const timer = window.setTimeout(() => {
      const block = Array.from(
        editorContainerRef.current?.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]") ?? [],
      ).find((element) => element.dataset.id === blockId);
      block?.scrollIntoView({ behavior: "smooth", block: "center" });
      block?.setAttribute("data-reference-target", "true");
      window.setTimeout(() => block?.removeAttribute("data-reference-target"), 2_000);
    });
    return () => window.clearTimeout(timer);
  }, [documentId, location.search]);
  useLayoutEffect(() => {
    const element = titleElementRef.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${element.scrollHeight}px`;
  }, [title]);
  const activeAnchorIsImage = Boolean(
    activeAnchorId && editor.getBlock(activeAnchorId)?.type === "image",
  );
  const blocker = useBlocker(() => {
    if (!dirty && !titleDirty) return false;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    return true;
  });

  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => {
      if (dirty || titleDirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty, titleDirty]);
  useEffect(() => {
    const root = editorContainerRef.current;
    const previous = root?.querySelector<HTMLElement>("[data-image-import-error]");
    previous?.removeAttribute("data-image-import-error");
    previous?.removeAttribute("aria-invalid");
    if (!root || !imageImportError) return;

    const block = Array.from(root.querySelectorAll<HTMLElement>(".bn-block-outer[data-id]")).find(
      (element) => element.dataset.id === imageImportError.blockId,
    );
    if (!block) return;
    block.dataset.imageImportError = imageImportError.message;
    block.setAttribute("aria-invalid", "true");
    block.scrollIntoView({ behavior: "smooth", block: "center" });

    return () => {
      block.removeAttribute("data-image-import-error");
      block.removeAttribute("aria-invalid");
    };
  }, [imageImportError]);
  const save = async (silent = false, expectedRevision = revision): Promise<boolean> => {
    if (adjustingAnchorRef.current) return false;
    if (saveInFlight.current) {
      await new Promise<void>((resolve) => saveWaiters.current.push(resolve));
      return saveRef.current(silent, revisionRef.current);
    }
    saveInFlight.current = true;
    if (!silent) setAutoSavePaused(false);
    setImageImportError(null);
    setIsPreparingSave(true);
    setSaveState("saving");
    let stage: "import" | "save" = "import";
    try {
      const initialContent = JSON.parse(JSON.stringify(editor.document)) as LazuliDocumentBlock;
      const initialAssets = collectAssetUrls(initialContent);
      const pendingCleanup = [...createdAssetUrls.current].filter((url) => !initialAssets.has(url));
      const failedPendingCleanup = await cleanupAssets(pendingCleanup);
      for (const url of pendingCleanup) createdAssetUrls.current.delete(url);
      for (const url of failedPendingCleanup) createdAssetUrls.current.add(url);

      const imported = await importExternalImages({
        content: initialContent,
        importImage: async (url) => (await importDocumentImage(projectId, documentId, url)).url,
        removeImage: removeAssetByUrl,
      });
      for (const url of imported.importedAssetUrls) createdAssetUrls.current.add(url);
      if (imported.importedAssetUrls.length)
        editor.replaceBlocks(editor.document, imported.content);

      const content = imported.content;
      const nextAssets = collectAssetUrls(content);
      const unusedCreatedAssets = [...createdAssetUrls.current].filter(
        (url) => !nextAssets.has(url),
      );
      const failedUnusedCleanup = await cleanupAssets(unusedCreatedAssets);
      for (const url of unusedCreatedAssets) createdAssetUrls.current.delete(url);
      for (const url of failedUnusedCleanup) createdAssetUrls.current.add(url);
      if (failedUnusedCleanup.length) toast.warning(DOCUMENT_MESSAGES.imageCleanupRetry);

      const snapshot = JSON.stringify(content);
      if (snapshot === cleanSnapshot.current) {
        setDirty(false);
        setSaveState(
          normalizeProjectItemTitle(titleRef.current) === savedTitle.current ? "saved" : "pending",
        );
        return true;
      }
      stage = "save";
      const result = await saveDocument.mutateAsync({
        content: toDocumentBlocks(content),
        expectedRevision,
      });
      if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
      retryAttempt.current = 0;
      setRevision(result.revision);
      revisionRef.current = result.revision;
      cleanSnapshot.current = snapshot;
      const removedAssets = [...cleanAssetUrls.current].filter((url) => !nextAssets.has(url));
      cleanAssetUrls.current = nextAssets;
      const failedCleanup = await cleanupAssets(removedAssets);
      for (const url of nextAssets) createdAssetUrls.current.delete(url);
      for (const url of failedCleanup) createdAssetUrls.current.add(url);
      const currentSnapshot = JSON.stringify(editor.document);
      const hasNewChanges = currentSnapshot !== snapshot;
      setDirty(hasNewChanges);
      setSaveState(
        hasNewChanges || normalizeProjectItemTitle(titleRef.current) !== savedTitle.current
          ? "pending"
          : "saved",
      );
      if (!silent) toast.success(DOCUMENT_MESSAGES.saveSuccess);
      if (failedCleanup.length) toast.warning(DOCUMENT_MESSAGES.savedWithCleanupPending);
      return true;
    } catch (error) {
      setAutoSavePaused(true);
      if (stage === "import") {
        setSaveState("error");
        if (error instanceof ExternalImageImportError) {
          for (const url of error.cleanupFailedAssetUrls) createdAssetUrls.current.add(url);
          const sourceRejected =
            error.cause instanceof ApiError && error.cause.code === "REMOTE_IMAGE_SOURCE_REJECTED";
          setImageImportError({
            blockId: error.blockId,
            message: sourceRejected
              ? "O site de origem bloqueou o download desta imagem. Remova-a ou envie o arquivo manualmente para salvar."
              : "Não foi possível importar esta imagem. Remova-a ou envie o arquivo manualmente para salvar.",
            sourceUrl: error.sourceUrl,
          });
          toast.error(
            sourceRejected
              ? "O site de origem bloqueou uma imagem. Ela foi destacada no documento."
              : "Não foi possível importar uma imagem. Ela foi destacada no documento.",
            {
              action: {
                label: "Remover imagem",
                onClick: () => editor.removeBlocks([error.blockId]),
              },
            },
          );
        } else toast.error("Não foi possível importar uma das imagens externas.");
      } else if (error instanceof ApiError && error.status === 409) {
        setSaveState("conflict");
        setConflictDialogOpen(true);
        toast.error(DOCUMENT_MESSAGES.revisionConflict);
      } else {
        setSaveState("error");
        toast.error(DOCUMENT_MESSAGES.saveError);
        const transient = error instanceof ApiError && (error.status === 0 || error.status >= 500);
        if (silent && transient && retryAttempt.current < 3) {
          retryAttempt.current += 1;
          retryTimer.current = window.setTimeout(
            () => {
              setAutoSavePaused(false);
              void saveRef.current(true);
            },
            2 ** retryAttempt.current * 1_000,
          );
        }
      }
      return false;
    } finally {
      saveInFlight.current = false;
      setIsPreparingSave(false);
      for (const resolve of saveWaiters.current.splice(0)) resolve();
    }
  };
  saveRef.current = save;
  useEffect(
    () => () => {
      if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!dirty || autoSavePaused || isPreparingSave || saveDocument.isPending || imageImportError)
      return;
    const timer = window.setTimeout(() => void saveRef.current(true), 1_500);
    return () => window.clearTimeout(timer);
  }, [autoSavePaused, dirty, imageImportError, isPreparingSave, saveDocument.isPending]);
  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (dirty && !adjustingAnchorRef.current) void saveRef.current(false);
      }
    };
    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [dirty]);
  useEffect(() => {
    const retryWhenOnline = () => {
      if (dirty && saveState === "error") {
        if (!adjustingAnchorRef.current) setAutoSavePaused(false);
        void saveRef.current(true);
      }
    };
    window.addEventListener("online", retryWhenOnline);
    return () => window.removeEventListener("online", retryWhenOnline);
  }, [dirty, saveState]);
  const titleRef = useRef(title);
  titleRef.current = title;
  const titleSaveInFlight = useRef(false);
  const titleSaveQueued = useRef(false);
  const finishTitle = async () => {
    if (titleSaveInFlight.current) {
      titleSaveQueued.current = true;
      return;
    }
    const normalized = normalizeProjectItemTitle(titleRef.current);
    if (!normalized) {
      setTitle(savedTitle.current);
      return;
    }
    if (normalized === savedTitle.current) return;
    titleSaveInFlight.current = true;
    setSaveState((current) => (current === "conflict" ? current : "saving"));
    try {
      await rename.mutateAsync({ itemId: documentId, input: { title: normalized } });
      savedTitle.current = normalized;
      setTitle(normalized);
      setSaveState((current) => {
        if (current === "conflict") return current;
        if (saveInFlight.current) return "saving";
        return dirty ? "pending" : "saved";
      });
    } catch {
      setSaveState((current) => (current === "conflict" ? current : "error"));
      toast.error("Não foi possível renomear o documento.");
    } finally {
      titleSaveInFlight.current = false;
      if (titleSaveQueued.current) {
        titleSaveQueued.current = false;
        queueMicrotask(() => void finishTitleRef.current());
      }
    }
  };
  const finishTitleRef = useRef(finishTitle);
  finishTitleRef.current = finishTitle;
  useEffect(() => {
    if (normalizeProjectItemTitle(title) === savedTitle.current) return;
    setSaveState((current) => (current === "conflict" ? current : "pending"));
    const timer = window.setTimeout(() => void finishTitleRef.current(), 900);
    return () => window.clearTimeout(timer);
  }, [title]);

  return (
    <>
      <div className="mr-1 h-full min-h-0 overflow-y-auto lazuli-thin-scrollbar">
        <header className="sticky top-0 z-20 bg-card/92 px-4 backdrop-blur sm:px-6">
          <div className="flex h-[3.75rem] items-center justify-end gap-2">
            {contextualReturnTo && (
              <Button
                className="mr-auto"
                onClick={() => void navigate(contextualReturnTo)}
                size="sm"
                variant="ghost"
              >
                <ArrowLeftIcon aria-hidden="true" /> Voltar
              </Button>
            )}
            <DocumentReferencesButton onClick={() => setDocumentReferencesOpen(true)} />
            <DocumentFind editorRef={editorContainerRef} showTrigger={false} />
            <Button
              onClick={async () => {
                const blocks = collectDocumentTextBlocks(editor.document as DocumentBlock[]);
                const selectedText = blocks.map(({ text }) => text).join(" ");
                if (!selectedText) {
                  toast.error("Adicione conteúdo ao documento antes de gerar materiais.");
                  return;
                }
                if (
                  blocks.length > AI_DOCUMENT_MAX_BLOCKS ||
                  selectedText.length > AI_DOCUMENT_MAX_TEXT_LENGTH
                ) {
                  toast.error(
                    "Este documento é grande demais para uma única geração. Selecione um trecho.",
                  );
                  return;
                }
                if (dirty && !(await saveRef.current(true))) {
                  toast.error("Salve as alterações do documento antes de gerar materiais.");
                  return;
                }
                void openAiFlow({
                  anchorId: null,
                  anchorCreated: false,
                  selectedText,
                  sourceBlockIds: [],
                  sourceScope: "document",
                });
              }}
              size="sm"
              variant="outline"
            >
              Gerar conteúdo
            </Button>
            <DocumentSaveStatus
              onOpenConflict={() => setConflictDialogOpen(true)}
              onRetry={() => {
                if (!adjustingAnchorRef.current) setAutoSavePaused(false);
                if (titleDirty) void finishTitle();
                if (dirty) void save(false);
              }}
              state={saveState}
            />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[52rem] px-5 pt-8 pb-24 sm:px-8 sm:pt-12">
          <Textarea
            aria-label="Título do documento"
            autoComplete="off"
            className="mb-8 min-h-16 w-full resize-none overflow-hidden border-transparent bg-transparent px-0 py-1 font-heading text-5xl leading-[1.02] font-normal tracking-[-0.04em] shadow-none focus-visible:border-transparent focus-visible:ring-0 sm:text-6xl md:text-6xl"
            data-1p-ignore
            data-lpignore="true"
            maxLength={100}
            onBlur={() => void finishTitle()}
            onChange={(event) => setTitle(event.target.value)}
            ref={titleElementRef}
            rows={1}
            value={title}
          />
          <div
            onClickCapture={(event) => {
              const target = event.target;
              if (!(target instanceof Element)) return;

              const sourceAnchor = target.closest<HTMLElement>(
                ".lazuli-source-anchor[data-anchor-id]",
              );
              if (sourceAnchor && event.currentTarget.contains(sourceAnchor)) {
                const anchorId = sourceAnchor.dataset.anchorId;
                if (anchorId) setActiveAnchorId(anchorId);
                return;
              }

              const link = target.closest("a[href]");
              if (!link || !event.currentTarget.contains(link) || event.ctrlKey || event.metaKey)
                return;
              event.preventDefault();
            }}
            ref={editorContainerRef}
          >
            <BlockNoteView
              className="lazuli-editor lazuli-document-editor"
              editor={editor}
              formattingToolbar={false}
              onChange={() => {
                if (saveState !== "conflict") {
                  if (!adjustingAnchorRef.current && !aiAction) setAutoSavePaused(false);
                  setSaveState("pending");
                }
                setImageImportError((current) => {
                  if (!current) return null;
                  const block = editor.getBlock(current.blockId);
                  if (
                    !block ||
                    block.type !== "image" ||
                    String(block.props.url) !== current.sourceUrl
                  )
                    return null;
                  return current;
                });
                setDirty(true);
              }}
              shadCNComponents={blockNoteComponents}
              theme="light"
            >
              <FormattingToolbarController formattingToolbar={formattingToolbar} />
            </BlockNoteView>
          </div>
          <p aria-live="assertive" className="sr-only">
            {imageImportError?.message}
          </p>
        </main>
      </div>
      {(pendingTarget || pendingAiReference || adjustingAnchorId) && (
        <div className="fixed bottom-5 left-1/2 z-40 flex w-[min(calc(100%-2rem),34rem)] -translate-x-1/2 items-center gap-3 rounded-[var(--radius-overlay)] border bg-popover px-4 py-3 shadow-[var(--shadow-overlay)]">
          <p className="min-w-0 flex-1 text-sm">
            {adjustingAnchorId
              ? "Selecione o novo trecho desta referência."
              : pendingAiReference
                ? "Selecione o novo trecho da referência sugerida."
                : "Selecione no documento o trecho que deseja vincular."}
          </p>
          <Button
            onClick={
              adjustingAnchorId
                ? cancelAdjustment
                : () =>
                    void navigate(
                      pendingAiReference?.returnTo ?? referenceReturnTo ?? location.pathname,
                      { replace: true },
                    )
            }
            size="sm"
            variant="outline"
          >
            Cancelar
          </Button>
          <Button
            disabled={!pendingSelectionAvailable}
            onClick={() =>
              adjustingAnchorId
                ? applyAdjustment()
                : pendingAiReference
                  ? selectPendingAiReference()
                  : setPendingLinkConfirmationOpen(true)
            }
            size="sm"
          >
            {adjustingAnchorId || pendingAiReference ? "Salvar trecho" : "Vincular trecho"}
          </Button>
        </div>
      )}
      <AlertDialog open={pendingLinkConfirmationOpen} onOpenChange={setPendingLinkConfirmationOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vincular o trecho selecionado?</AlertDialogTitle>
            <AlertDialogDescription>
              A referência será adicionada e você voltará ao material.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setPendingLinkConfirmationOpen(false);
                void selectPendingTarget();
              }}
            >
              Vincular trecho
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <DocumentMaterialFlow
        action={materialAction}
        documentId={documentId}
        onCancel={() => closeMaterialFlow(true)}
        onComplete={() => closeMaterialFlow(false)}
        persistDocument={() => saveRef.current(true)}
      />
      <AiSelectionGenerationDialog
        action={aiAction}
        documentId={documentId}
        documentRevision={revisionRef.current}
        getDocumentContent={() => editor.document as DocumentBlock[]}
        open={aiDialogOpen}
        onApproved={async () => {
          let remote: Awaited<ReturnType<typeof fetchDocument>>;
          try {
            remote = await fetchDocument(projectId, documentId);
          } catch {
            // Approval has already committed the generated materials and source anchors.
            // Reload instead of leaving stale local content that autosave could overwrite.
            window.location.reload();
            return;
          }
          const nextContent = remote.content as LazuliDocumentBlock;
          editor.replaceBlocks(editor.document, nextContent);
          const snapshot = JSON.stringify(nextContent);
          setRevision(remote.revision);
          revisionRef.current = remote.revision;
          cleanSnapshot.current = snapshot;
          cleanAssetUrls.current = collectAssetUrls(nextContent);
          setDirty(false);
          setSaveState(titleDirty ? "pending" : "saved");
          void closeAiFlow(false);
        }}
        onCancel={() => void closeAiFlow(true)}
        onMinimize={() => setAiDialogOpen(false)}
      />
      {aiAction && !aiDialogOpen && (
        <Button
          className="fixed right-5 bottom-5 z-40 shadow-[var(--shadow-overlay)]"
          onClick={() => setAiDialogOpen(true)}
        >
          Continuar geração com IA
        </Button>
      )}
      {linkAction && !pendingTarget && (
        <ExistingMaterialPickerDialog
          onCancel={() => closeMaterialFlow(true, linkAction.anchorId, linkAction.anchorCreated)}
          onComplete={() => closeMaterialFlow(false)}
          persistDocument={() => saveRef.current(true)}
          source={{ type: "selection", documentId, anchorId: linkAction.anchorId }}
          sourcePreview={linkAction.selectedText}
        />
      )}
      {wholeDocumentPickerOpen && (
        <ExistingMaterialPickerDialog
          onCancel={() => setWholeDocumentPickerOpen(false)}
          onComplete={() => setWholeDocumentPickerOpen(false)}
          persistDocument={() => saveRef.current(true)}
          source={{ type: "document", documentId }}
        />
      )}
      <DocumentReferencesDialog
        anchorId={activeAnchorId ?? undefined}
        documentId={documentId}
        onCreateFlashcard={
          activeAnchorId && activeAnchorIsImage
            ? () => {
                setMaterialAction({
                  anchorId: activeAnchorId,
                  anchorCreated: false,
                  kind: "flashcard",
                  selectedText: "Imagem selecionada",
                });
                setActiveAnchorId(null);
              }
            : undefined
        }
        onCreateQuiz={
          activeAnchorId && activeAnchorIsImage
            ? () => {
                setMaterialAction({
                  anchorId: activeAnchorId,
                  anchorCreated: false,
                  kind: "quizQuestion",
                  selectedText: "Imagem selecionada",
                });
                setActiveAnchorId(null);
              }
            : undefined
        }
        onAdd={
          activeAnchorId
            ? () => {
                setLinkAction({
                  anchorId: activeAnchorId,
                  anchorCreated: false,
                  selectedText: activeAnchorIsImage ? "Imagem selecionada" : "",
                });
                setActiveAnchorId(null);
              }
            : undefined
        }
        onAdjust={
          activeAnchorId && !activeAnchorIsImage
            ? () => {
                adjustmentSnapshot.current = structuredClone(editor.document);
                adjustingAnchorRef.current = activeAnchorId;
                setAdjustingAnchorId(activeAnchorId);
                setAutoSavePaused(true);
                const next = removeSourceAnchors(
                  toDocumentBlocks(editor.document),
                  new Set([activeAnchorId]),
                ).content as LazuliDocumentBlock;
                editor.replaceBlocks(editor.document, next);
                setActiveAnchorId(null);
              }
            : undefined
        }
        onOpenChange={(open) => !open && setActiveAnchorId(null)}
        onLastReferenceRemoved={async (anchorId) => {
          const localContent = removeSourceAnchors(
            toDocumentBlocks(editor.document),
            new Set([anchorId]),
          ).content as LazuliDocumentBlock;
          const hadUnsavedChanges = dirty;
          const remote = await fetchDocument(projectId, documentId);
          queryClient.setQueryData(documentKeys.detail(projectId, documentId), remote);
          editor.replaceBlocks(
            editor.document,
            hadUnsavedChanges ? localContent : (remote.content as LazuliDocumentBlock),
          );
          setRevision(remote.revision);
          revisionRef.current = remote.revision;
          if (hadUnsavedChanges) {
            setDirty(true);
            setSaveState("pending");
          } else {
            cleanSnapshot.current = JSON.stringify(remote.content);
            setDirty(false);
            setSaveState("saved");
          }
          setActiveAnchorId(null);
        }}
        open={Boolean(activeAnchorId)}
      />
      <DocumentReferencesDialog
        documentId={documentId}
        onAdd={() => {
          setDocumentReferencesOpen(false);
          setWholeDocumentPickerOpen(true);
        }}
        onOpenChange={setDocumentReferencesOpen}
        open={documentReferencesOpen}
      />
      <AlertDialog open={blocker.state === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair sem salvar?</AlertDialogTitle>
            <AlertDialogDescription>
              As alterações feitas neste documento ainda não foram salvas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>
              Continuar editando
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => blocker.proceed?.()}>
              Sair sem salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog onOpenChange={setConflictDialogOpen} open={conflictDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Este documento foi alterado em outro lugar</AlertDialogTitle>
            <AlertDialogDescription>
              Escolha qual versão deve permanecer. Sua edição local continuará disponível até você
              decidir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:flex-wrap">
            <AlertDialogCancel className="whitespace-nowrap">Continuar editando</AlertDialogCancel>
            <Button
              onClick={() => {
                void fetchDocument(projectId, documentId)
                  .then((remote) => {
                    const abandonedAssets = [...createdAssetUrls.current];
                    createdAssetUrls.current.clear();
                    if (abandonedAssets.length)
                      void cleanupAssets(abandonedAssets).then((failed) => {
                        for (const url of failed) createdAssetUrls.current.add(url);
                      });
                    editor.replaceBlocks(editor.document, remote.content as LazuliDocumentBlock);
                    setRevision(remote.revision);
                    revisionRef.current = remote.revision;
                    cleanSnapshot.current = JSON.stringify(remote.content);
                    cleanAssetUrls.current = collectAssetUrls(
                      remote.content as LazuliDocumentBlock,
                    );
                    setDirty(false);
                    setAutoSavePaused(false);
                    setSaveState("saved");
                    setConflictDialogOpen(false);
                  })
                  .catch(() => toast.error("Não foi possível carregar a versão mais recente."));
              }}
              className="whitespace-nowrap"
              variant="outline"
            >
              Usar versão do servidor
            </Button>
            <AlertDialogAction
              className="whitespace-nowrap"
              onClick={(event) => {
                event.preventDefault();
                void fetchDocument(projectId, documentId)
                  .then((remote) => {
                    setRevision(remote.revision);
                    revisionRef.current = remote.revision;
                    setAutoSavePaused(false);
                    setConflictDialogOpen(false);
                    return save(false, remote.revision);
                  })
                  .catch(() => toast.error("Não foi possível confirmar a versão mais recente."));
              }}
            >
              <CheckIcon /> Manter minha versão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
