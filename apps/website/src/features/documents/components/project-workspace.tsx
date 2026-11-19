import type { ProjectTreeItem } from "@lazuli/shared";
import { FilesIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from "@/components/icons.tsx";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { cn } from "@/lib/utils.ts";
import { DocumentTree } from "./document-tree.tsx";
import { DocumentTreeAction } from "./document-tree-toolbar.tsx";

export const ProjectWorkspace = ({
  projectId,
  items,
  activeDocumentId,
  projectTitle,
  children,
}: {
  projectId: string;
  items: ProjectTreeItem[];
  activeDocumentId?: string;
  projectTitle?: string;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="project-workspace min-w-0 flex-1 bg-background">
      <div className="project-workspace-grid min-h-0 min-w-0" data-tree-collapsed={collapsed}>
        {/* One toggle on the column's right edge: it travels with the edge as the column folds,
            so nothing disappears in one place and reappears in another. */}
        <aside className="project-workspace-tree sticky top-0 h-svh overflow-hidden">
          <div
            className={cn(
              "h-full transition-[opacity,translate] duration-200 ease-out motion-reduce:transition-none",
              collapsed && "pointer-events-none -translate-x-4 opacity-0",
            )}
            inert={collapsed}
          >
            <DocumentTree
              activeDocumentId={activeDocumentId}
              items={items}
              projectId={projectId}
              projectTitle={projectTitle}
            />
          </div>
          <DocumentTreeAction
            // Open: on the panel's header line. Closed: centred in the gap between the app sidebar
            // and the document (the 48px column plus the sheet's 8px margin).
            className={cn(
              "project-tree-toggle absolute top-[1.5625rem] z-10 transition-[right] duration-200 ease-out",
              collapsed ? "right-1.5" : "right-2.5",
            )}
            label={collapsed ? "Mostrar arquivos" : "Ocultar arquivos"}
            onClick={() => setCollapsed(!collapsed)}
          >
            <span className="relative grid size-4 place-items-center">
              <PanelLeftCloseIcon
                className={cn("absolute transition-opacity duration-200", collapsed && "opacity-0")}
              />
              <PanelLeftOpenIcon
                className={cn(
                  "absolute transition-opacity duration-200",
                  !collapsed && "opacity-0",
                )}
              />
            </span>
          </DocumentTreeAction>
        </aside>
        <div
          className="project-workspace-content min-h-0 min-w-0"
          data-document-open={Boolean(activeDocumentId)}
        >
          <Popover onOpenChange={setOpen} open={open}>
            <PopoverTrigger asChild>
              <Button
                className="project-files-trigger fixed top-2.5 right-4 z-50 size-9 bg-card"
                size="icon-lg"
                variant="outline"
              >
                <FilesIcon className="size-5" />
                <span className="sr-only">Abrir documentos</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="h-[min(72svh,36rem)] w-[min(calc(100vw-2rem),20rem)] overflow-hidden p-0 shadow-[var(--shadow-float)]"
              side="bottom"
              sideOffset={8}
            >
              <DocumentTree
                activeDocumentId={activeDocumentId}
                items={items}
                onNavigate={() => setOpen(false)}
                projectId={projectId}
                projectTitle={projectTitle}
                showProjectLink={false}
              />
            </PopoverContent>
          </Popover>
          {children}
        </div>
      </div>
    </div>
  );
};
