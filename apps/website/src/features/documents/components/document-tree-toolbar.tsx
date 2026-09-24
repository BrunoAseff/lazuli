import {
  FilePlus2Icon,
  FolderPlusIcon,
  PanelLeftCloseIcon,
  SearchIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";

import { SearchInput } from "@/components/search-input.tsx";
import { Button } from "@/components/ui/button.tsx";
import type { DocumentTreeCloseIcon, DocumentTreeCreateType } from "../document-tree-types.ts";

export const DocumentTreeToolbar = ({
  closeIcon,
  onClose,
  onCreate,
  onImport,
  onSearchChange,
  onSearchOpenChange,
  search,
  searchOpen,
}: {
  closeIcon: DocumentTreeCloseIcon;
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
          <Button
            aria-label="Pesquisar documentos"
            onClick={() => onSearchOpenChange(true)}
            size="icon-sm"
            variant="ghost"
          >
            <SearchIcon />
          </Button>
          <Button
            aria-label="Importar documentos"
            onClick={onImport}
            size="icon-sm"
            title="Importar documentos"
            variant="ghost"
          >
            <UploadIcon />
          </Button>
          <Button
            aria-label="Nova pasta"
            onClick={() => onCreate("folder")}
            size="icon-sm"
            variant="ghost"
          >
            <FolderPlusIcon />
          </Button>
          <Button
            aria-label="Novo documento"
            onClick={() => onCreate("document")}
            size="icon-sm"
            variant="ghost"
          >
            <FilePlus2Icon />
          </Button>
          {onClose && (
            <Button aria-label="Ocultar arquivos" onClick={onClose} size="icon-sm" variant="ghost">
              {closeIcon === "x" ? <XIcon /> : <PanelLeftCloseIcon />}
            </Button>
          )}
        </>
      )}
    </div>
  );
};
