import { normalizeProjectItemTitle } from "@lazuli/shared";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { LoaderCircleIcon, SaveIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input.tsx";
import { ApiError } from "@/lib/api-client.ts";
import {
  importDocumentImage,
  removeAssetByUrl,
  releaseResolvedAssetUrls,
  resolveAssetUrl,
  uploadDocumentImage,
} from "../api/document-api.ts";
import { useDocument, useRenameProjectItem, useSaveDocument } from "../api/document-queries.ts";
import { DOCUMENT_MESSAGES } from "../document-messages.ts";
import { lazuliBlockNoteDictionary } from "../editor/blocknote-dictionary.ts";
import { cleanupAssets, collectAssetUrls } from "../editor/document-assets.ts";
import { documentSchema, type LazuliDocumentBlock } from "../editor/document-schema.tsx";
import { DocumentFind } from "../editor/document-find.tsx";
import {
  ExternalImageImportError,
  importExternalImages,
} from "../editor/import-external-images.ts";
import { LocalizedBlockNoteInput } from "../editor/localized-blocknote-input.tsx";

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
  const editorContainerRef = useRef<HTMLDivElement>(null);
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
  const blocker = useBlocker(() => {
    if (!dirty) return false;
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    return true;
  });

  useEffect(() => {
    const prevent = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
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
  const save = async () => {
    setImageImportError(null);
    setIsPreparingSave(true);
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
        return;
      }
      stage = "save";
      const result = await saveDocument.mutateAsync({ content, expectedRevision: revision });
      setRevision(result.revision);
      cleanSnapshot.current = snapshot;
      const removedAssets = [...cleanAssetUrls.current].filter((url) => !nextAssets.has(url));
      cleanAssetUrls.current = nextAssets;
      const failedCleanup = await cleanupAssets(removedAssets);
      for (const url of nextAssets) createdAssetUrls.current.delete(url);
      for (const url of failedCleanup) createdAssetUrls.current.add(url);
      setDirty(false);
      toast.success(DOCUMENT_MESSAGES.saveSuccess);
      if (failedCleanup.length) toast.warning(DOCUMENT_MESSAGES.savedWithCleanupPending);
    } catch (error) {
      if (stage === "import") {
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
      } else if (error instanceof ApiError && error.status === 409)
        toast.error(DOCUMENT_MESSAGES.revisionConflict);
      else toast.error(DOCUMENT_MESSAGES.saveError);
    } finally {
      setIsPreparingSave(false);
    }
  };
  const finishTitle = async () => {
    const normalized = normalizeProjectItemTitle(title);
    if (!normalized) {
      setTitle(data.item.title);
      return;
    }
    if (normalized === savedTitle.current) return;
    try {
      await rename.mutateAsync({ itemId: documentId, input: { title: normalized } });
      savedTitle.current = normalized;
    } catch {
      setTitle(savedTitle.current);
      toast.error("Não foi possível renomear o documento.");
    }
  };

  return (
    <>
      <header className="sticky top-0 z-20 bg-background/95 px-4 py-5 backdrop-blur sm:px-6">
        <div className="flex h-9 items-center justify-end">
          <DocumentFind editorRef={editorContainerRef} showTrigger={false} />
          <Button
            className="h-9"
            disabled={!dirty || isPreparingSave || saveDocument.isPending}
            onClick={() => void save()}
          >
            {isPreparingSave || saveDocument.isPending ? (
              <LoaderCircleIcon className="animate-spin" />
            ) : (
              <SaveIcon />
            )}
            Salvar
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl px-5 pt-5 pb-12 sm:px-8 sm:pt-8">
        <Input
          aria-label="Título do documento"
          autoComplete="off"
          className="mb-7 h-auto min-h-14 w-full border-transparent bg-transparent px-0 py-1 font-heading text-4xl leading-tight font-semibold shadow-none focus-visible:border-transparent focus-visible:ring-0 sm:text-5xl md:text-5xl"
          data-1p-ignore
          data-lpignore="true"
          maxLength={100}
          onBlur={() => void finishTitle()}
          onChange={(event) => setTitle(event.target.value)}
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
    </>
  );
};
