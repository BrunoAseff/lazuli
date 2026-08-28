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
      <div className="flex flex-1">
        <Skeleton className="hidden w-64 rounded-none lg:block" />
        <div className="flex-1 space-y-5 p-8">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-96 w-full" />
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
    <div className="min-h-full">
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
