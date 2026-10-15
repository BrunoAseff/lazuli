import {
  FilePlus2Icon,
  FolderPlusIcon,
  PanelLeftCloseIcon,
  SearchIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import type { ComponentProps } from "react";

import { SearchInput } from "@/components/search-input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import type { DocumentTreeCloseIcon, DocumentTreeCreateType } from "../document-tree-types.ts";

const ToolbarAction = ({
  label,
  children,
  ...props
}: ComponentProps<typeof Button> & { label: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button aria-label={label} size="icon-sm" variant="ghost" {...props}>
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent side="bottom" sideOffset={6}>
      {label}
    </TooltipContent>
  </Tooltip>
);

export const DocumentTreeToolbar = ({
  closeIcon,
  hasItems,
  onClose,
  onCreate,
  onImport,
  onSearchChange,
  onSearchOpenChange,
  search,
  searchOpen,
}: {
  closeIcon: DocumentTreeCloseIcon;
  hasItems: boolean;
  onClose?: () => void;
  onCreate: (type: DocumentTreeCreateType) => void;
  onImport: () => void;
  onSearchChange: (value: string) => void;
  onSearchOpenChange: (open: boolean) => void;
  search: string;
  searchOpen: boolean;
}) => {
  return (
    <div className="flex h-11 shrink-0 items-center gap-1 px-2">
      {searchOpen ? (
        <SearchInput
          alwaysShowClear
          clearLabel="Fechar pesquisa"
          autoFocus
          className="h-8"
          containerClassName="flex-1"
          onClear={() => {
            onSearchOpenChange(false);
            onSearchChange("");
          }}
          onValueChange={onSearchChange}
          placeholder="Pesquisar arquivos"
          value={search}
        />
      ) : (
        <>
          <span className="min-w-0 flex-1" />
          <ToolbarAction
            disabled={!hasItems}
            label="Pesquisar documentos"
            onClick={() => onSearchOpenChange(true)}
          >
            <SearchIcon />
          </ToolbarAction>
          <ToolbarAction label="Importar documentos" onClick={onImport}>
            <UploadIcon />
          </ToolbarAction>
          <ToolbarAction label="Nova pasta" onClick={() => onCreate("folder")}>
            <FolderPlusIcon />
          </ToolbarAction>
          <ToolbarAction label="Novo documento" onClick={() => onCreate("document")}>
            <FilePlus2Icon />
          </ToolbarAction>
          {onClose && (
            <ToolbarAction label="Ocultar arquivos" onClick={onClose}>
              {closeIcon === "x" ? <XIcon /> : <PanelLeftCloseIcon />}
            </ToolbarAction>
          )}
        </>
      )}
    </div>
  );
};
