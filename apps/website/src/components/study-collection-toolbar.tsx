import type { StudyCollectionStatus } from "@lazuli/shared";
import { SearchIcon, XIcon } from "lucide-react";

import { ProjectFilter, type ProjectFilterValue } from "@/components/project-filter.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";

export const StudyCollectionToolbar = ({
  onClearSearch,
  onProjectChange,
  onSearchChange,
  onStatusChange,
  project,
  searchValue,
  status,
}: {
  onClearSearch: () => void;
  onProjectChange: (value: ProjectFilterValue) => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: StudyCollectionStatus) => void;
  project: ProjectFilterValue;
  searchValue: string;
  status: StudyCollectionStatus;
}) => (
  <div className="my-8 grid gap-3 border-y py-3 lg:grid-cols-[minmax(15rem,1fr)_auto_auto] lg:items-center">
    <div className="relative min-w-0 lg:max-w-md">
      <SearchIcon
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        aria-label="Pesquisar coleções"
        className="h-9 pr-9 pl-9"
        maxLength={100}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Pesquisar coleções"
        type="text"
        value={searchValue}
      />
      {searchValue && (
        <Button
          aria-label="Limpar pesquisa"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          onClick={onClearSearch}
          size="icon-sm"
          variant="ghost"
        >
          <XIcon aria-hidden="true" />
        </Button>
      )}
    </div>
    <ProjectFilter onChange={onProjectChange} value={project} />
    <Tabs onValueChange={(value) => onStatusChange(value as StudyCollectionStatus)} value={status}>
      <TabsList aria-label="Estado das coleções" variant="line">
        <TabsTrigger value="active">Ativas</TabsTrigger>
        <TabsTrigger value="archived">Arquivadas</TabsTrigger>
      </TabsList>
    </Tabs>
  </div>
);
