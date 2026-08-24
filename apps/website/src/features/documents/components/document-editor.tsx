import { normalizeProjectItemTitle } from "@lazuli/shared";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { CheckIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useBlocker } from "react-router";
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
  const [title, setTitle] = useState(data.item.title);
  const cleanSnapshot = useRef(JSON.stringify(data.content));
  const savedTitle = useRef(data.item.title);
  const cleanAssetUrls = useRef(collectAssetUrls(data.content as LazuliDocumentBlock));
  const createdAssetUrls = useRef(new Set<string>());
  const saveInFlight = useRef(false);
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
  useEffect(() => releaseResolvedAssetUrls, [documentId]);
  useLayoutEffect(() => {
    const element = titleElementRef.current;
    if (!element) return;
    element.style.height = "0px";
    element.style.height = `${element.scrollHeight}px`;
  }, [title]);
  const titleDirty = normalizeProjectItemTitle(title) !== savedTitle.current;
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
  const save = async (silent = false, expectedRevision = revision) => {
    if (saveInFlight.current) return;
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
        return;
      }
      stage = "save";
      const result = await saveDocument.mutateAsync({ content, expectedRevision });
      if (retryTimer.current !== null) window.clearTimeout(retryTimer.current);
      retryTimer.current = null;
      retryAttempt.current = 0;
      setRevision(result.revision);
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
    } finally {
      saveInFlight.current = false;
      setIsPreparingSave(false);
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
        if (dirty) void saveRef.current(false);
      }
    };
    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [dirty]);
  useEffect(() => {
    const retryWhenOnline = () => {
      if (dirty && saveState === "error") {
        setAutoSavePaused(false);
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
        <div className="flex h-9 items-center justify-end">
          <DocumentFind editorRef={editorContainerRef} showTrigger={false} />
          <DocumentSaveStatus
            onOpenConflict={() => setConflictDialogOpen(true)}
            onRetry={() => {
              setAutoSavePaused(false);
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
            onChange={() => {
              if (saveState !== "conflict") {
                setAutoSavePaused(false);
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
          />
        </div>
        <p aria-live="assertive" className="sr-only">
          {imageImportError?.message}
        </p>
      </main>
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
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
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
              variant="outline"
            >
              Usar versão do servidor
            </Button>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void fetchDocument(projectId, documentId)
                  .then((remote) => {
                    setRevision(remote.revision);
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
