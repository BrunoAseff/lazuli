import { isNotFound, ResourceUnavailable } from "@/components/not-found-page.tsx";
import { useLocation, useParams } from "react-router";

import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useDocument } from "../api/document-queries.ts";
import { DocumentEditor } from "../components/document-editor.tsx";
import { safeReturnTo } from "../document-navigation.ts";

export const DocumentEditorPage = () => {
  const { projectId = "", documentId = "" } = useParams();
  const location = useLocation();
  const returnTo = safeReturnTo(new URLSearchParams(location.search).get("returnTo"));
  const document = useDocument(projectId, documentId);
  if (document.isPending)
    return (
      <div className="document-editor-page flex flex-1 flex-col">
        <div className="flex h-[3.75rem] items-center justify-end border-b px-6">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="mx-auto w-full max-w-[52rem] space-y-8 px-8 py-12">
          <Skeleton className="h-14 w-2/3" />
          <div className="space-y-4">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-11/12" />
            <Skeleton className="h-5 w-4/5" />
          </div>
        </div>
      </div>
    );
  if (document.isError || !document.data)
    return (
      <ResourceUnavailable
        backLabel={returnTo ? "Voltar" : "Voltar ao projeto"}
        backTo={returnTo ?? `/documents/${projectId}`}
        notFound={isNotFound(document.error) || !document.isError}
        onRetry={() => void document.refetch()}
        title="Documento não encontrado"
      />
    );
  return (
    <div className="document-editor-page">
      <DocumentEditor
        data={document.data}
        documentId={documentId}
        key={documentId}
        projectId={projectId}
      />
    </div>
  );
};

export default DocumentEditorPage;
