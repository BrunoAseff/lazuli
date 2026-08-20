import { FilePlus2Icon, FolderPlusIcon, PanelLeftCloseIcon, SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";

export const DocumentTreeToolbar = ({
  closeIcon,
  onClose,
  onCreate,
  onSearchChange,
  onSearchOpenChange,
  search,
  searchOpen,
}: {
  closeIcon: "panel" | "x";
  onClose?: () => void;
  onCreate: (type: "folder" | "document") => void;
  onSearchChange: (value: string) => void;
  onSearchOpenChange: (open: boolean) => void;
  search: string;
  searchOpen: boolean;
}) => (
  <div className="flex h-11 shrink-0 items-center gap-1 px-2">
    {searchOpen ? (
      <>
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            className="h-8 pr-2 pl-8"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Pesquisar arquivos"
            type="text"
            value={search}
          />
        </div>
        <Button
          aria-label="Fechar pesquisa"
          onClick={() => {
            onSearchOpenChange(false);
            onSearchChange("");
          }}
          size="icon-sm"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </>
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
