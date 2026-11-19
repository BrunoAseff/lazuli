import { FilePlus2Icon, FolderPlusIcon, UploadIcon } from "@/components/icons.tsx";
import type { ComponentProps } from "react";

import { SearchInput } from "@/components/search-input.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import type { DocumentTreeCreateType } from "../document-tree-types.ts";
import "@/components/study-index.css";

export const DocumentTreeAction = ({
  label,
  children,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: ComponentProps<typeof Button> & { label: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button aria-label={label} size={size} variant={variant} {...props}>
        {children}
      </Button>
    </TooltipTrigger>
    <TooltipContent side="bottom" sideOffset={6}>
      {label}
    </TooltipContent>
  </Tooltip>
);

/** Creation acts on the project; search acts on the list below. Each keeps its own row. */
export const DocumentTreeToolbar = ({
  onCreate,
  onImport,
  onSearchChange,
  search,
}: {
  onCreate: (type: DocumentTreeCreateType) => void;
  onImport: () => void;
  onSearchChange: (value: string) => void;
  search: string;
}) => (
  <div className="shrink-0 px-4 pb-2.5">
    <div className="study-index-actions mb-2" data-layout="one-labeled">
      <Button onClick={() => onCreate("document")} variant="outline">
        <FilePlus2Icon /> Novo documento
      </Button>
      <DocumentTreeAction
        label="Nova pasta"
        onClick={() => onCreate("folder")}
        size="icon"
        variant="outline"
      >
        <FolderPlusIcon />
      </DocumentTreeAction>
      <DocumentTreeAction
        label="Importar documentos"
        onClick={onImport}
        size="icon"
        variant="outline"
      >
        <UploadIcon />
      </DocumentTreeAction>
    </div>
    <div>
      <SearchInput
        clearLabel="Limpar pesquisa de arquivos"
        containerClassName="flex-1"
        onClear={() => onSearchChange("")}
        onValueChange={onSearchChange}
        placeholder="Pesquisar arquivos"
        value={search}
      />
    </div>
  </div>
);
