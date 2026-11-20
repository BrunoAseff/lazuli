import type { CSSProperties, ReactNode } from "react";

import { CutGem } from "@/components/brand/cut-gem.tsx";
import { ContentPage } from "@/components/content-page.tsx";

/*
 * Internal study page (development only): a bluer rough stone, so the shine scale reads from the
 * first level. Each option overrides the rough tones on its own block; nothing reaches the app.
 */

const levels = [
  { name: "Bruta", cut: 0 },
  { name: "Desbastada", cut: 0.4 },
  { name: "Facetada", cut: 0.62 },
  { name: "Lapidada", cut: 0.85 },
  { name: "Polida", cut: 1 },
];

const options = [
  {
    id: "current",
    label: "Atual",
    note: "Cinza-azulado de pouca cor: sem saturação e com saturação quase não se distinguem.",
    tones: { rough: "#5d6589", light: "#7c84a6", dark: "#444b6b" },
  },
  {
    id: "a",
    label: "A · Lápis bruto",
    note: "Azul fosco de verdade, mais escuro que a gema lapidada. A escala se lê do primeiro passo ao último.",
    tones: { rough: "#3d4f9a", light: "#5a6cb6", dark: "#2a3876" },
  },
  {
    id: "b",
    label: "B · Mais contido",
    note: "Entre os dois: mais azul que o atual, menos que A. A escala se lê, com passos mais curtos.",
    tones: { rough: "#4a5794", light: "#6a77ad", dark: "#333f74" },
  },
];

const toneStyle = (tones: (typeof options)[number]["tones"]) =>
  ({
    "--gem-rough": tones.rough,
    "--gem-rough-light": tones.light,
    "--gem-rough-dark": tones.dark,
  }) as CSSProperties;

const Row = ({ children, label }: { children: ReactNode; label: string }) => (
  <div className="grid gap-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    {children}
  </div>
);

export default function ProposalsPage() {
  return (
    <ContentPage maxWidth="6xl">
      <h1 className="page-title">Propostas</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        Pedra bruta mais azulada, para o brilho se ler desde o nível 1. Nada aqui está aplicado no
        app.
      </p>

      <div className="mt-8 grid gap-4">
        {options.map((option) => (
          <section
            className="surface-panel grid gap-6 p-6 sm:p-8 lg:grid-cols-[15rem_minmax(0,1fr)]"
            key={option.id}
            style={toneStyle(option.tones)}
          >
            <div>
              <h2 className="text-sm font-semibold">{option.label}</h2>
              <p className="mt-1 text-[0.8125rem] text-muted-foreground">{option.note}</p>
            </div>
            <div className="flex flex-wrap items-start gap-x-16 gap-y-6">
              <Row label="Brilho em Bruta: nenhum dia → todos">
                <div className="flex items-center gap-6">
                  <CutGem cut={0} dull={1} size={72} />
                  <div className="flex items-center gap-1">
                    {[0, 1, 2, 3, 4].map((kept) => (
                      <CutGem cut={0} dull={1 - kept / 4} key={kept} size={24} />
                    ))}
                  </div>
                  <CutGem cut={0} size={72} />
                </div>
              </Row>
              <Row label="Níveis, com brilho total">
                <div className="flex items-end gap-4">
                  {levels.map((level) => (
                    <div className="grid justify-items-center gap-1.5" key={level.name}>
                      <CutGem cut={level.cut} size={40} />
                      <span className="text-[0.6875rem] text-muted-foreground">{level.name}</span>
                    </div>
                  ))}
                </div>
              </Row>
            </div>
          </section>
        ))}
      </div>
    </ContentPage>
  );
}
