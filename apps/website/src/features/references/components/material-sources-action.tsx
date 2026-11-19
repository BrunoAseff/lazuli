import { REFERENCE_MAX_PAGE_SIZE, type ReferenceTarget } from "@lazuli/shared";
import { useReferences } from "../api/reference-queries.ts";
import { MaterialReferencesButton } from "./material-references-dialog.tsx";

/** Shares the manager's query cache. Reading a source does not require opening editing controls. */
export function MaterialSourcesAction({ target }: { target: ReferenceTarget }) {
  const references = useReferences({
    page: 1,
    pageSize: REFERENCE_MAX_PAGE_SIZE,
    targetId: target.id,
    targetType: target.type,
  });
  const count = references.data?.items.length ?? 0;
  return (
    <MaterialReferencesButton
      target={target}
      count={count}
      label={count === 1 ? "Ver fonte" : "Ver fontes"}
    />
  );
}
