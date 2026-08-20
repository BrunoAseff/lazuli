import { normalizeProjectItemTitle, type ProjectTreeItem } from "@lazuli/shared";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileTextIcon,
  FolderIcon,
  HomeIcon,
  MoreHorizontalIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { HighlightText } from "@/components/highlight-text.tsx";
import { OverflowTooltip } from "@/components/overflow-tooltip.tsx";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { Input } from "@/components/ui/input.tsx";
import { cn } from "@/lib/utils.ts";
import { useDocumentImports } from "@/features/document-imports/document-import-provider.tsx";
import { foldSearchText } from "@/lib/text.ts";
import {
  useCreateProjectItem,
  useDeleteProjectItem,
  useMoveProjectItem,
  useRenameProjectItem,
} from "../api/document-queries.ts";
import { downloadDocumentMarkdown } from "../api/document-api.ts";
import { buildProjectChildren, collectProjectDescendantIds } from "../project-tree.ts";
import { DOCUMENT_MESSAGES } from "../document-messages.ts";
import { DocumentTreeActions } from "./document-tree-actions.tsx";
import { ProjectItemDeleteDialog } from "./project-item-delete-dialog.tsx";
import { DocumentTreeToolbar } from "./document-tree-toolbar.tsx";

type Props = {
  projectId: string;
  items: ProjectTreeItem[];
  activeDocumentId?: string;
  onClose?: () => void;
  onNavigate?: () => void;
  closeIcon?: "panel" | "x";
};

type PendingCreation = {
  parentId: string | null;
  type: "folder" | "document";
};

const treeItemPadding = (depth: number) => 12 + depth * 16;

export const DocumentTree = ({
  projectId,
  items,
  activeDocumentId,
  onClose,
  onNavigate,
  closeIcon = "panel",
}: Props) => {
  const navigate = useNavigate();
  const { openImportDialog } = useDocumentImports();
  const createItem = useCreateProjectItem(projectId);
  const renameItem = useRenameProjectItem(projectId);
  const moveItem = useMoveProjectItem(projectId);
  const deleteItem = useDeleteProjectItem(projectId);
  const [expanded, setExpanded] = useState(() => new Set<string>());
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const renameCancelled = useRef(false);
  const [creating, setCreating] = useState<PendingCreation | null>(null);
  const [creationTitle, setCreationTitle] = useState("");
  const creationCancelled = useRef(false);
  const [deleting, setDeleting] = useState<ProjectTreeItem | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null | undefined>(undefined);
  const afterFocusMoves = (action: () => void) =>
    window.requestAnimationFrame(() => window.requestAnimationFrame(action));

  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const visibleIds = useMemo(() => {
    if (!search.trim()) return null;
    const query = foldSearchText(search.trim());
    const visible = new Set<string>();
    for (const item of items) {
      if (!foldSearchText(item.title).includes(query)) continue;
      let current: ProjectTreeItem | undefined = item;
      while (current) {
        visible.add(current.id);
        current = current.parentId ? byId.get(current.parentId) : undefined;
      }
    }
    return visible;
  }, [byId, items, search]);
  const children = useMemo(() => {
    const map = buildProjectChildren(
      visibleIds ? items.filter((item) => visibleIds.has(item.id)) : items,
    );
    for (const siblings of map.values())
      siblings.sort(
        (left, right) => left.position - right.position || left.id.localeCompare(right.id),
      );
    return map;
  }, [items, visibleIds]);

  useEffect(() => {
    if (!activeDocumentId) return;
    setExpanded((current) => {
      const next = new Set(current);
      let item = byId.get(activeDocumentId);
      while (item?.parentId) {
        next.add(item.parentId);
        item = byId.get(item.parentId);
      }
      return next;
    });
  }, [activeDocumentId, byId]);

  const toggleExpanded = (itemId: string) =>
    setExpanded((value) => {
      const next = new Set(value);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  const openDocument = (itemId: string) => {
    onNavigate?.();
    void navigate(`/documents/${projectId}/document/${itemId}`);
  };
  const requestImport = (parentId: string | null) => {
    openImportDialog(projectId, parentId);
  };

  const beginCreate = (type: PendingCreation["type"], parentId: string | null = null) => {
    if (parentId) setExpanded((value) => new Set(value).add(parentId));
    creationCancelled.current = false;
    setCreating({ parentId, type });
    setCreationTitle("");
  };
  const add = async () => {
    if (!creating) return;
    const pending = creating;
    const title = normalizeProjectItemTitle(creationTitle);
    setCreating(null);
    setCreationTitle("");
    if (!title) return;
    try {
      const item = await createItem.mutateAsync({
        id: crypto.randomUUID(),
        type: pending.type,
        parentId: pending.parentId,
        title,
      });
      toast.success(
        pending.type === "folder"
          ? DOCUMENT_MESSAGES.createFolderSuccess
          : DOCUMENT_MESSAGES.createDocumentSuccess,
      );
      if (pending.type === "document") void navigate(`/documents/${projectId}/document/${item.id}`);
    } catch {
      toast.error(DOCUMENT_MESSAGES.createError);
    }
  };
  const startRename = (item: ProjectTreeItem) => {
    renameCancelled.current = false;
    setEditing(item.id);
    setDraft(item.title);
  };
  const finishRename = async (item: ProjectTreeItem) => {
    if (renameCancelled.current) {
      renameCancelled.current = false;
      return;
    }
    const title = normalizeProjectItemTitle(draft);
    setEditing(null);
    if (!title || title === item.title) return;
    try {
      await renameItem.mutateAsync({ itemId: item.id, input: { title } });
      toast.success(DOCUMENT_MESSAGES.renameSuccess);
    } catch {
      toast.error(DOCUMENT_MESSAGES.renameError);
    }
  };
  const descendantsContainActive = (rootId: string) => {
    return activeDocumentId
      ? collectProjectDescendantIds(items, rootId).has(activeDocumentId)
      : false;
  };
  const canMove = (itemId: string, parentId: string | null) => {
    let currentId: string | null = parentId;
    while (currentId) {
      if (currentId === itemId) return false;
      currentId = byId.get(currentId)?.parentId ?? null;
    }
    return byId.get(itemId)?.parentId !== parentId;
  };
  const move = async (itemId: string, parentId: string | null) => {
    setDropTargetId(undefined);
    setDraggedId(null);
    if (!canMove(itemId, parentId)) return;
    try {
      await moveItem.mutateAsync({ itemId, input: { parentId } });
      if (parentId) setExpanded((value) => new Set(value).add(parentId));
      toast.success(
        parentId ? DOCUMENT_MESSAGES.moveToFolderSuccess : DOCUMENT_MESSAGES.moveToRootSuccess,
      );
    } catch {
      toast.error(DOCUMENT_MESSAGES.moveError);
    }
  };

  const createDragPreview = (event: DragEvent, item: ProjectTreeItem) => {
    const preview = document.createElement("div");
    const label = document.createElement("span");
    const icon = event.currentTarget.querySelector("[data-tree-icon]")?.cloneNode(true);
    preview.className = "lazuli-tree-drag-preview";
    label.textContent = item.title;
    if (icon) preview.append(icon);
    preview.append(label);
    document.body.append(preview);
    event.dataTransfer.setDragImage(preview, 14, 18);
    requestAnimationFrame(() => preview.remove());
  };

  const renderCreation = (parentId: string | null, depth: number) => {
    if (creating?.parentId !== parentId || visibleIds) return null;
    return (
      <div
        className="flex h-9 items-center gap-1 rounded-md pr-3 text-sm"
        style={{ paddingLeft: `${treeItemPadding(depth)}px` }}
      >
        <span className="size-5 shrink-0" />
        {creating.type === "folder" ? (
          <FolderIcon className="size-4 shrink-0 text-muted-foreground" />
        ) : (
          <FileTextIcon className="size-4 shrink-0 text-muted-foreground" data-tree-icon />
        )}
        <Input
          aria-label={creating.type === "folder" ? "Nome da pasta" : "Nome do documento"}
          autoFocus
          autoComplete="off"
          className="h-7 min-w-0 flex-1 px-1.5"
          data-1p-ignore
          data-lpignore="true"
          maxLength={100}
          onBlur={() => {
            if (creationCancelled.current) {
              creationCancelled.current = false;
              return;
            }
            void add();
          }}
          onChange={(event) => setCreationTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              creationCancelled.current = true;
              setCreating(null);
            }
          }}
          placeholder={creating.type === "folder" ? "Nome da pasta" : "Nome do documento"}
          value={creationTitle}
        />
      </div>
    );
  };

  const render = (parentId: string | null, depth = 0): React.ReactNode => (
    <>
      {(children.get(parentId) ?? []).map((item) => {
        const isFolder = item.type === "folder";
        const isOpen = visibleIds ? true : expanded.has(item.id);
        const isActive = item.id === activeDocumentId;
        const isDropTarget = dropTargetId === item.id;
        const label =
          editing === item.id ? (
            <Input
              autoFocus
              autoComplete="off"
              className="h-7 min-w-0 flex-1 px-1.5"
              data-1p-ignore
              data-lpignore="true"
              maxLength={100}
              onBlur={() => void finishRename(item)}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                  renameCancelled.current = true;
                  setEditing(null);
                }
              }}
              value={draft}
            />
          ) : isFolder ? (
            <OverflowTooltip side="right" text={item.title}>
              {(ref) => (
                <button
                  className="min-w-0 flex-1 truncate text-left transition-[padding] duration-100 group-hover:pr-7 group-focus-within:pr-7 group-has-data-[state=open]:pr-7"
                  data-tree-label
                  onClick={(event) => {
                    if (event.detail > 1) return;
                    toggleExpanded(item.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "F2") startRename(item);
                  }}
                  ref={ref as React.RefObject<HTMLButtonElement>}
                >
                  <HighlightText query={search} text={item.title} />
                </button>
              )}
            </OverflowTooltip>
          ) : (
            <OverflowTooltip side="right" text={item.title}>
              {(ref) => (
                <Link
                  className="min-w-0 flex-1 truncate transition-[padding] duration-100 group-hover:pr-7 group-focus-within:pr-7 group-has-data-[state=open]:pr-7"
                  data-tree-label
                  onClick={(event) => {
                    if (event.detail > 1 && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
                      event.preventDefault();
                      return;
                    }
                    onNavigate?.();
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "F2") {
                      event.preventDefault();
                      startRename(item);
                    }
                  }}
                  ref={ref as React.RefObject<HTMLAnchorElement>}
                  to={`/documents/${projectId}/document/${item.id}`}
                >
                  <HighlightText query={search} text={item.title} />
                </Link>
              )}
            </OverflowTooltip>
          );

        return (
          <div aria-expanded={isFolder ? isOpen : undefined} key={item.id} role="treeitem">
            <ContextMenu modal={false}>
              <ContextMenuTrigger asChild>
                <div
                  aria-grabbed={draggedId === item.id}
                  className={cn(
                    "group relative flex h-9 cursor-pointer items-center gap-1 rounded-sm pr-3 text-sm transition-colors hover:bg-muted/60",
                    isActive && "bg-muted font-medium text-foreground",
                    isDropTarget && "bg-muted ring-1 ring-inset ring-foreground/20",
                    draggedId === item.id && "opacity-45",
                  )}
                  draggable={editing !== item.id}
                  onClick={(event) => {
                    if (editing === item.id || event.detail > 1) return;
                    const target = event.target;
                    if (target instanceof Element && target.closest("button, a, input")) return;
                    if (isFolder) toggleExpanded(item.id);
                    else openDocument(item.id);
                  }}
                  onDoubleClick={(event) => {
                    const target = event.target;
                    if (
                      editing === item.id ||
                      (target instanceof Element &&
                        target.closest("button:not([data-tree-label]), input"))
                    )
                      return;
                    event.preventDefault();
                    startRename(item);
                  }}
                  onDragEnd={() => {
                    setDraggedId(null);
                    setDropTargetId(undefined);
                  }}
                  onDragOver={(event) => {
                    if (!isFolder || !draggedId) return;
                    event.stopPropagation();
                    if (!canMove(draggedId, item.id)) return;
                    event.preventDefault();
                    setDropTargetId(item.id);
                  }}
                  onDragStart={(event) => {
                    setDraggedId(item.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", item.id);
                    createDragPreview(event, item);
                  }}
                  onDrop={(event) => {
                    if (!isFolder || !draggedId) return;
                    event.stopPropagation();
                    const itemId = event.dataTransfer.getData("text/plain");
                    if (itemId && canMove(itemId, item.id)) {
                      event.preventDefault();
                      void move(itemId, item.id);
                    }
                  }}
                  style={{ paddingLeft: `${treeItemPadding(depth)}px` }}
                >
                  {isFolder ? (
                    <button
                      aria-label={isOpen ? `Recolher ${item.title}` : `Expandir ${item.title}`}
                      className="grid size-5 shrink-0 place-items-center rounded-sm hover:bg-transparent"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleExpanded(item.id);
                      }}
                      type="button"
                    >
                      {isOpen ? (
                        <ChevronDownIcon className="size-3.5" />
                      ) : (
                        <ChevronRightIcon className="size-3.5" />
                      )}
                    </button>
                  ) : (
                    <span className="size-5 shrink-0" />
                  )}
                  {isFolder ? (
                    <FolderIcon className="size-4 shrink-0 text-muted-foreground" data-tree-icon />
                  ) : (
                    <FileTextIcon
                      className="size-4 shrink-0 text-muted-foreground"
                      data-tree-icon
                    />
                  )}
                  {label}
                  {editing !== item.id && (
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          aria-label={`Ações de ${item.title}`}
                          className="absolute right-1 size-7 opacity-0 hover:bg-transparent group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 data-[state=open]:bg-transparent data-[state=open]:opacity-100"
                          size="icon"
                          variant="ghost"
                        >
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className="min-w-44"
                        onCloseAutoFocus={(event) => event.preventDefault()}
                        side="right"
                      >
                        <DocumentTreeActions
                          item={item}
                          onCreate={(type) => afterFocusMoves(() => beginCreate(type, item.id))}
                          onDelete={() => afterFocusMoves(() => setDeleting(item))}
                          onExport={
                            item.type === "document"
                              ? () =>
                                  void downloadDocumentMarkdown(
                                    projectId,
                                    item.id,
                                    item.title,
                                  ).catch(() => toast.error("Não foi possível baixar o documento."))
                              : undefined
                          }
                          onImport={
                            item.type === "folder" ? () => requestImport(item.id) : undefined
                          }
                          onRename={() => afterFocusMoves(() => startRename(item))}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </ContextMenuTrigger>
              <ContextMenuContent
                className="min-w-44"
                onCloseAutoFocus={(event) => event.preventDefault()}
              >
                <DocumentTreeActions
                  context
                  item={item}
                  onCreate={(type) => afterFocusMoves(() => beginCreate(type, item.id))}
                  onDelete={() => afterFocusMoves(() => setDeleting(item))}
                  onExport={
                    item.type === "document"
                      ? () =>
                          void downloadDocumentMarkdown(projectId, item.id, item.title).catch(() =>
                            toast.error("Não foi possível baixar o documento."),
                          )
                      : undefined
                  }
                  onImport={item.type === "folder" ? () => requestImport(item.id) : undefined}
                  onRename={() => afterFocusMoves(() => startRename(item))}
                />
              </ContextMenuContent>
            </ContextMenu>
            {isFolder &&
              isOpen &&
              ((children.get(item.id)?.length ?? 0) > 0 || creating?.parentId === item.id) && (
                <div>{render(item.id, depth + 1)}</div>
              )}
          </div>
        );
      })}
      {renderCreation(parentId, depth)}
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <DocumentTreeToolbar
        closeIcon={closeIcon}
        onClose={onClose}
        onCreate={(type) => afterFocusMoves(() => beginCreate(type))}
        onImport={() => requestImport(null)}
        onSearchChange={setSearch}
        onSearchOpenChange={setSearchOpen}
        search={search}
        searchOpen={searchOpen}
      />
      <div
        aria-label="Arquivos do projeto"
        className={cn(
          "min-h-0 flex-1 overflow-auto rounded-md py-1 transition-colors",
          dropTargetId === null && "bg-muted/40 ring-1 ring-inset ring-foreground/15",
        )}
        onDragOver={(event) => {
          if (!draggedId || !canMove(draggedId, null)) return;
          event.preventDefault();
          setDropTargetId(null);
        }}
        onDrop={(event) => {
          event.preventDefault();
          const itemId = event.dataTransfer.getData("text/plain");
          if (itemId) void move(itemId, null);
        }}
        role="tree"
      >
        <div
          className={cn(
            "mb-1 flex h-9 items-center gap-2 rounded-sm px-3 text-sm transition-colors hover:bg-muted/60",
            !activeDocumentId && "bg-muted font-medium text-foreground",
          )}
        >
          <HomeIcon className="size-4 shrink-0 text-muted-foreground" />
          <Link
            className="min-w-0 flex-1 truncate"
            onClick={onNavigate}
            to={`/documents/${projectId}`}
          >
            Início
          </Link>
        </div>
        {render(null)}
        {visibleIds?.size === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum arquivo encontrado.
          </p>
        )}
      </div>
      <ProjectItemDeleteDialog
        item={deleting}
        onConfirm={(item) => {
          const goHome = descendantsContainActive(item.id);
          void deleteItem
            .mutateAsync(item.id)
            .then(() => {
              if (goHome) void navigate(`/documents/${projectId}`);
              toast.success(DOCUMENT_MESSAGES.deleteSuccess);
            })
            .catch(() => toast.error(DOCUMENT_MESSAGES.deleteError));
        }}
        onOpenChange={(open) => !open && setDeleting(null)}
      />
    </div>
  );
};
