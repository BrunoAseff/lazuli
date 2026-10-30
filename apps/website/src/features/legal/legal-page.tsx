import { useEffect } from "react";
import { Link, useLocation, useParams } from "react-router";
import { ArrowLeft, Printer, ChevronDown } from "lucide-react";
import { LEGAL_CONTACT } from "@lazuli/shared";
import { getLegalDocument, LEGAL_DOCUMENTS } from "@lazuli/shared/legal/documents";
import { Button } from "@/components/ui/button.tsx";
import { LegalLinks } from "./legal-links.tsx";
import "./legal-print.css";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu.tsx";

const formatDate = (date: string) =>
  new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(`${date}T12:00:00`));

export default function LegalPage() {
  const location = useLocation();
  const { version } = useParams();
  const kind = location.pathname.startsWith("/termos") ? "terms" : "privacy";
  const document = getLegalDocument(kind, version);
  useEffect(() => {
    const previousTitle = window.document.title;
    window.document.title = `${document?.title ?? "Documento não encontrado"} · Lazúli`;
    if (!location.hash) window.scrollTo(0, 0);
    else {
      let anchor = location.hash.slice(1);
      try {
        anchor = decodeURIComponent(anchor);
      } catch {
        /* An invalid anchor must not break a public document. */
      }
      window.document.getElementById(anchor)?.scrollIntoView();
    }
    return () => {
      window.document.title = previousTitle;
    };
  }, [document, location.hash]);

  return (
    <div className="lazuli-legal-page min-h-svh bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8 print:hidden">
        <Link to="/" className="font-heading text-2xl font-semibold tracking-tight">
          Lazúli
        </Link>
        <Button variant="ghost" asChild>
          <Link to="/">
            <ArrowLeft />
            Início
          </Link>
        </Button>
      </header>
      {!document ? (
        <main className="mx-auto max-w-2xl px-5 py-16">
          <h1 className="font-heading text-3xl">Versão não encontrada</h1>
          <p className="mt-3 text-muted-foreground">
            Consulte a versão disponível deste documento.
          </p>
          <Button variant="outline" className="mt-6" asChild>
            <Link to={kind === "terms" ? "/termos" : "/privacidade"}>Ver documento atual</Link>
          </Button>
        </main>
      ) : (
        <main className="mx-auto max-w-6xl px-5 pt-7 pb-16 sm:px-8 sm:pt-12 print:p-0">
          <div className="max-w-3xl">
            <h1 className="font-heading text-4xl leading-tight tracking-tight sm:text-5xl">
              {document.title}
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Vigência: {formatDate(document.effectiveAt)} · Versão {document.version}
            </p>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              {document.summary}
            </p>
          </div>
          <div className="mt-10 grid items-start gap-10 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14 print:block">
            <aside className="lg:sticky lg:top-8 print:hidden">
              <div className="lg:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-between">
                      Nesta página
                      <ChevronDown />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="max-h-[60svh] w-[min(22rem,calc(100vw-2.5rem))] overflow-y-auto"
                    align="start"
                  >
                    {document.sections.map((section) => (
                      <DropdownMenuItem asChild key={section.id}>
                        <a href={`#${section.id}`}>{section.title}</a>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <nav aria-label="Nesta página" className="hidden lg:block">
                <p className="mb-3 text-sm font-semibold">Nesta página</p>
                <ul className="grid gap-2 text-sm">
                  {document.sections.map((section) => (
                    <li key={section.id}>
                      <a
                        className="block py-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        href={`#${section.id}`}
                      >
                        {section.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              <Button className="mt-5" variant="outline" onClick={() => window.print()}>
                <Printer />
                Imprimir
              </Button>
            </aside>
            <article className="min-w-0 max-w-[70ch] space-y-9 print:max-w-none">
              {document.sections.map((section) => (
                <section className="scroll-mt-8" id={section.id} key={section.id}>
                  <h2 className="font-heading text-2xl leading-snug">{section.title}</h2>
                  <div className="mt-3 space-y-3 text-base leading-7 text-foreground/90">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              ))}
              <section className="border-t pt-6" aria-labelledby="legal-contact">
                <h2 id="legal-contact" className="font-heading text-2xl">
                  Contato
                </h2>
                <a
                  className="mt-3 inline-block break-all text-primary underline underline-offset-4"
                  href={`mailto:${LEGAL_CONTACT.email}`}
                >
                  {LEGAL_CONTACT.email}
                </a>
              </section>
              <nav aria-label="Versões publicadas" className="border-t pt-6 print:hidden">
                <h2 className="font-heading text-xl">Versões publicadas</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {LEGAL_DOCUMENTS.filter((edition) => edition.kind === kind).map((edition) => (
                    <li key={edition.version}>
                      <Link
                        className="underline underline-offset-4"
                        to={`/${kind === "terms" ? "termos" : "privacidade"}/${edition.version}`}
                        aria-current={edition.version === document.version ? "page" : undefined}
                      >
                        {formatDate(edition.publishedAt)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </article>
          </div>
        </main>
      )}
      <footer className="mx-auto max-w-6xl px-5 py-8 sm:px-8 print:hidden">
        <LegalLinks />
      </footer>
    </div>
  );
}
