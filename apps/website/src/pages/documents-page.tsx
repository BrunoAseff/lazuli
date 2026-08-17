import { FileTextIcon } from "lucide-react";

export const DocumentsPage = () => (
  <div className="flex flex-1 flex-col px-5 py-8 sm:px-8 lg:px-12 lg:py-10">
    <div className="mx-auto w-full max-w-6xl">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Biblioteca pessoal
      </p>
      <h1 className="font-heading text-4xl font-medium tracking-tight sm:text-5xl">Documentos</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        Seus projetos e documentos serão organizados aqui na próxima etapa.
      </p>

      <section className="mt-10 grid min-h-72 place-items-center border border-dashed bg-card/40 px-5 text-center">
        <div className="max-w-sm">
          <span className="mx-auto mb-4 flex size-10 items-center justify-center border bg-background text-primary">
            <FileTextIcon aria-hidden="true" className="size-5" />
          </span>
          <h2 className="font-heading text-2xl font-medium">
            Sua biblioteca começa no próximo passo
          </h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            A autenticação está pronta. A criação e organização de projetos chega no Dia 2.
          </p>
        </div>
      </section>
    </div>
  </div>
);

export default DocumentsPage;
