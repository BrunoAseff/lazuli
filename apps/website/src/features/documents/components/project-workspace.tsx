import type { ProjectTreeItem } from "@lazuli/shared";
import { FilesIcon, PanelLeftOpenIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import { cn } from "@/lib/utils.ts";
import { DocumentTree } from "./document-tree.tsx";

export const ProjectWorkspace = ({
  projectId,
  items,
  activeDocumentId,
  children,
}: {
  projectId: string;
  items: ProjectTreeItem[];
  activeDocumentId?: string;
  children: ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="project-workspace min-h-0 min-w-0 flex-1 overflow-x-clip bg-background">
      <div className="project-workspace-grid min-h-full min-w-0" data-tree-collapsed={collapsed}>
        <aside
          className={cn(
            "project-workspace-tree sticky top-0 h-svh overflow-hidden py-5 transition-[width] duration-200 ease-out",
            collapsed ? "w-11" : "w-60",
          )}
        >
          <div
            className={cn(
              "h-full w-60 transition-opacity duration-150",
              collapsed && "pointer-events-none opacity-0",
            )}
          >
            <DocumentTree
              activeDocumentId={activeDocumentId}
              items={items}
              onClose={() => setCollapsed(true)}
              projectId={projectId}
            />
          </div>
          <div
            className={cn(
              "pointer-events-none absolute top-5 right-0 flex h-11 items-center justify-end px-2 opacity-0 transition-opacity duration-150",
              collapsed && "pointer-events-auto opacity-100 delay-100",
            )}
          >
            <Button
              aria-label="Mostrar arquivos"
              onClick={() => setCollapsed(false)}
              size="icon-sm"
              title="Mostrar arquivos"
              variant="ghost"
            >
              <PanelLeftOpenIcon />
            </Button>
          </div>
        </aside>
        <div className="project-workspace-content min-h-full min-w-0">
          <Popover onOpenChange={setOpen} open={open}>
            <PopoverTrigger asChild>
              <Button
                className="project-files-trigger fixed right-4 bottom-4 z-30 size-11 rounded-full bg-background shadow-lg"
                size="icon-lg"
                variant="outline"
              >
                <FilesIcon className="size-5" />
                <span className="sr-only">Abrir documentos</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="h-[min(70svh,34rem)] w-[min(calc(100vw-2rem),20rem)] overflow-hidden rounded-lg p-0 shadow-xl"
              side="top"
              sideOffset={10}
            >
              <DocumentTree
                activeDocumentId={activeDocumentId}
                items={items}
                onNavigate={() => setOpen(false)}
                projectId={projectId}
              />
            </PopoverContent>
          </Popover>
          {children}
        </div>
      </div>
    </div>
  );
};
