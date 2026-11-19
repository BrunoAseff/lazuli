import { Skeleton } from "./ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import { StudyIndexSkeleton } from "./study-index.tsx";

/** Match the real workbench columns and mobile pane; loading must not invent a different layout. */
export function StudyWorkspaceSkeleton({ editorOpen = false }: { editorOpen?: boolean }) {
  return (
    <main className="study-workspace" aria-busy="true" aria-label="Carregando coleção">
      <div className="study-workspace-columns">
        <aside className={cn("min-h-0 flex-col md:flex", editorOpen ? "hidden" : "flex")}>
          <div className="px-4 pt-4 pb-3.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-4 h-5 w-48" />
            <Skeleton className="mt-2 h-3 w-36" />
            <div className="mt-4 flex gap-1.5">
              <Skeleton className="h-7 w-20" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="size-7" />
            </div>
          </div>
          <div className="px-4">
            <Skeleton className="h-9 w-full" />
          </div>
          <StudyIndexSkeleton label="Carregando itens" />
        </aside>
        <div className={cn("min-w-0 flex-col px-6 py-6 md:flex", editorOpen ? "flex" : "hidden")}>
          <div className="flex justify-end gap-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-7 w-20" />
          </div>
          <div className="mx-auto mt-10 w-full max-w-3xl space-y-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-11/12" />
            <Skeleton className="h-8 w-3/5" />
            <Skeleton className="mt-10 h-px w-full" />
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        </div>
      </div>
    </main>
  );
}
