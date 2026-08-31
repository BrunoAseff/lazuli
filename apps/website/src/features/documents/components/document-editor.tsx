import {
  normalizeProjectItemTitle,
  referenceTargetSchema,
  removeSourceAnchors,
} from "@lazuli/shared";
import { FormattingToolbarController, useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { ArrowLeftIcon, CheckIcon } from "lucide-react";
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
import { useDocument, useRenameProjectItem, useSaveDocument } from "../api/document-queries.ts";
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
export const DocumentEditor = ({
  projectId,
  documentId,
  data,
}: {
  projectId: string;
  documentId: string;
  data: NonNullable<ReturnType<typeof useDocument>["data"]>;
}) => {
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
  const contextualReturnTo = useMemo(
    () => safeReturnTo(new URLSearchParams(location.search).get("returnTo")),
    [location.search],
  );
  const cleanSnapshot = useRef(JSON.stringify(data.content));
  const savedTitle = useRef(data.item.title);
  const cleanAssetUrls = useRef(collectAssetUrls(data.content as LazuliDocumentBlock));
  const createdAssetUrls = useRef(new Set<string>());
  const adjustmentSnapshot = useRef<LazuliDocumentBlock | null>(null);
  const adjustingAnchorRef = useRef<string | null>(null);
  const saveInFlight = useRef(false);
  const saveWaiters = useRef<Array<() => void>>([]);
  const retryAttempt = useRef(0);
  const retryTimer = useRef<number | null>(null);
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
        adjustingAnchorId ? { anchorId: adjustingAnchorId } : undefined,
      ),
    [adjustingAnchorId, finishAdjustment, openMaterialFlow],
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
        const next = removeSourceAnchors(
          editor.document as LazuliDocumentBlock,
          new Set([anchorId]),
        ).content as LazuliDocumentBlock;
        editor.replaceBlocks(editor.document, next);
      }
      toast.error("Não foi possível vincular o trecho.");
    }
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
      const next = removeSourceAnchors(editor.document as LazuliDocumentBlock, new Set([anchorId]))
        .content as LazuliDocumentBlock;
      editor.replaceBlocks(editor.document, next);
    }
    setMaterialAction(null);
    setLinkAction(null);
  };
  useEffect(() => releaseResolvedAssetUrls, [documentId]);
  useEffect(() => {
    if (!pendingTarget && !adjustingAnchorId) {
      setPendingSelectionAvailable(false);
      return;
    }
    const update = () =>
      setPendingSelectionAvailable(Boolean(getDocumentReferenceSelection(editor)));
    update();
    return editor.onSelectionChange(update);
  }, [adjustingAnchorId, editor, pendingTarget]);
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
  useLayoutEffect(() => {
    const element = titleElementRef.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${element.scrollHeight}px`;
  }, [title]);
  const titleDirty = normalizeProjectItemTitle(title) !== savedTitle.current;
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
      const result = await saveDocument.mutateAsync({ content, expectedRevision });
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
  const saveRef = useRef(save);
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
      <header className="sticky top-0 z-20 bg-background/95 px-4 py-5 backdrop-blur sm:px-6">
        <div className="flex h-9 items-center justify-end gap-2">
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
      <main className="mx-auto w-full max-w-4xl px-5 pt-5 pb-12 sm:px-8 sm:pt-8">
        <Textarea
          aria-label="Título do documento"
          autoComplete="off"
          className="mb-7 min-h-14 w-full resize-none overflow-hidden border-transparent bg-transparent px-0 py-1 font-heading text-4xl leading-tight font-semibold shadow-none focus-visible:border-transparent focus-visible:ring-0 sm:text-5xl md:text-5xl"
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

            const imageReferenceTrigger = target.closest<HTMLElement>(
              "[data-image-reference-trigger]",
            );
            if (imageReferenceTrigger && event.currentTarget.contains(imageReferenceTrigger)) {
              const blockId = imageReferenceTrigger.dataset.imageReferenceTrigger;
              const imageBlock = imageReferenceTrigger.closest<HTMLElement>(
                ".bn-block-outer[data-id]",
              );
              if (blockId && imageBlock?.dataset.id === blockId) setActiveAnchorId(blockId);
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
            className="lazuli-editor"
            editor={editor}
            formattingToolbar={false}
            onChange={() => {
              if (saveState !== "conflict") {
                if (!adjustingAnchorRef.current) setAutoSavePaused(false);
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
      {(pendingTarget || adjustingAnchorId) && (
        <div className="fixed bottom-5 left-1/2 z-40 flex w-[min(calc(100%-2rem),34rem)] -translate-x-1/2 items-center gap-3 rounded-xl border bg-popover px-4 py-3 shadow-lg">
          <p className="min-w-0 flex-1 text-sm">
            {adjustingAnchorId
              ? "Selecione o novo trecho desta referência."
              : "Selecione no documento o trecho que deseja vincular."}
          </p>
          <Button
            onClick={
              adjustingAnchorId
                ? cancelAdjustment
                : () => void navigate(referenceReturnTo ?? location.pathname, { replace: true })
            }
            size="sm"
            variant="outline"
          >
            Cancelar
          </Button>
          <Button
            disabled={!pendingSelectionAvailable}
            onClick={() =>
              adjustingAnchorId ? applyAdjustment() : setPendingLinkConfirmationOpen(true)
            }
            size="sm"
          >
            {adjustingAnchorId ? "Salvar trecho" : "Vincular trecho"}
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
                adjustmentSnapshot.current = structuredClone(
                  editor.document as LazuliDocumentBlock,
                );
                adjustingAnchorRef.current = activeAnchorId;
                setAdjustingAnchorId(activeAnchorId);
                setAutoSavePaused(true);
                const next = removeSourceAnchors(
                  editor.document as LazuliDocumentBlock,
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
            editor.document as LazuliDocumentBlock,
            new Set([anchorId]),
          ).content as LazuliDocumentBlock;
          const hadUnsavedChanges = dirty;
          const remote = await fetchDocument(projectId, documentId);
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
