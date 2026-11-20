import { STONE_LEVELS } from "@lazuli/shared";
import { useState } from "react";

import { CutGem } from "@/components/brand/cut-gem.tsx";
import { ContentPage } from "@/components/content-page.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { LevelUpDialog } from "@/features/stone/components/level-up-dialog.tsx";
import { setSoundsEnabled, soundsEnabled } from "@/features/stone/level-up-sound.ts";

/*
 * Internal study page (development only): the level-up moment, playable. The dialog is the real
 * component that would open over the end-of-session summary when the stone goes up a level.
 */

const steps = STONE_LEVELS.slice(1).map((level) => ({
  from: level.level - 1,
  to: level.level,
  mastered: level.from,
}));

export default function ProposalsPage() {
  const [playing, setPlaying] = useState<(typeof steps)[number] | null>(null);
  const [sound, setSound] = useState(soundsEnabled);
  const [forceMotion, setForceMotion] = useState(false);
  return (
    <ContentPage maxWidth="6xl">
      <h1 className="page-title">Propostas</h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
        O momento de subir de nível, para aprovação. Nada aqui está aplicado no app.
      </p>

      <section className="surface-panel mt-8 grid gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="grid content-start gap-5">
          <div>
            <h2 className="text-sm font-semibold">Ver a subida</h2>
            <p className="mt-1 text-[0.8125rem] text-muted-foreground">
              Abre por cima do resumo da prática ou do quiz em que o nível subiu. Clique em qualquer
              lugar do diálogo para pular para o fim.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {steps.map((step) => (
              <Button key={step.to} onClick={() => setPlaying(step)} variant="outline">
                <span className="flex items-center gap-1.5">
                  <CutGem cut={STONE_LEVELS[step.from - 1]!.cut} size={18} />→
                  <CutGem cut={STONE_LEVELS[step.to - 1]!.cut} size={18} />
                </span>
                {STONE_LEVELS[step.to - 1]!.name}
              </Button>
            ))}
          </div>
          <label className="flex w-fit items-center gap-3 text-sm">
            <Switch
              checked={sound}
              onCheckedChange={(checked) => {
                setSound(checked);
                setSoundsEnabled(checked);
              }}
            />
            Som
          </label>
          <label className="flex w-fit items-center gap-3 text-sm">
            <Switch checked={forceMotion} onCheckedChange={setForceMotion} />
            Ignorar “reduzir movimento” do sistema (só nesta demonstração)
          </label>
        </div>
        <ol className="grid content-start gap-2 text-[0.8125rem] text-muted-foreground">
          <li>
            <span className="text-foreground">A pedra antiga</span> aparece sobre a tela escurecida.
          </li>
          <li>
            <span className="text-foreground">Três batidas de cinzel:</span> a pedra cede a cada
            toque, com um som curto que sobe de tom.
          </li>
          <li>
            <span className="text-foreground">O novo corte:</span> a forma se transforma, com um
            leve crescimento e um sino; o nome do nível troca letra a letra.
          </li>
          <li>
            <span className="text-foreground">O acabamento:</span> um reflexo atravessa a pedra e
            lascas de pirita sobem dela.
          </li>
          <li>
            <span className="text-foreground">Os detalhes:</span> nível, dominados, a trilha com o
            novo corte aceso e o próximo; depois, Continuar.
          </li>
        </ol>
      </section>

      {playing && (
        <LevelUpDialog
          forceMotion={forceMotion}
          from={playing.from}
          key={`${playing.to}-${Date.now()}`}
          mastered={playing.mastered}
          onOpenChange={(open) => !open && setPlaying(null)}
          open
          to={playing.to}
        />
      )}
    </ContentPage>
  );
}
