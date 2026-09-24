import { TriangleAlertIcon } from "lucide-react";
import { Link, useLocation, useParams } from "react-router";

import { Button } from "@/components/ui/button.tsx";
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
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
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
      <div className="grid flex-1 place-items-center p-8 text-center">
        <div>
          <TriangleAlertIcon className="mx-auto mb-4 size-8 text-muted-foreground" />
          <h1 className="font-heading text-3xl">Documento não encontrado</h1>
          <Button asChild className="mt-5" variant="outline">
            <Link to={returnTo ?? `/documents/${projectId}`}>Voltar</Link>
          </Button>
        </div>
      </div>
    );
  return (
    <div className="h-full min-h-0 overflow-hidden">
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
