import { ContentPage } from "@/components/content-page.tsx";

/*
 * Internal study page (development only): visual decisions wait here for approval before they
 * reach the app. Each approved proposal is applied and then removed from this page.
 */
export default function ProposalsPage() {
  return (
    <ContentPage maxWidth="6xl">
      <h1 className="page-title">Propostas</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Nenhuma proposta aguardando aprovação.
      </p>
    </ContentPage>
  );
}
