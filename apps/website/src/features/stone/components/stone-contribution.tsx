import {
  nextStoneLevel,
  stoneLevelByNumber,
  type StoneContribution,
  type StoneSessionKind,
} from "@lazuli/shared";
import { useEffect, useState } from "react";

import { CutGem } from "@/components/brand/cut-gem.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { useStoneContribution } from "../api/stone-queries.ts";
import { goldBar, levelTitle } from "./stone-parts.tsx";

/* What a practice or quiz added, shown in its summary: the goal of today and the mastery. */

const useTween = (from: number, to: number, duration = 1100, delay = 250) => {
  const [value, setValue] = useState(from);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(to);
      return;
    }
    let frame = 0;
    const start = performance.now() + delay;
    const step = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      setValue(from + (to - from) * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [delay, duration, from, to]);
  return value;
};

const RisingStone = ({ from, to }: { from: number; to: number }) => {
  const cut = useTween(stoneLevelByNumber(from).cut, stoneLevelByNumber(to).cut);
  return <CutGem cut={cut} size={72} />;
};

/** The level-up notice, at the top of the summary: the stone takes its new cut. */
export const StoneLevelUp = ({ id, kind }: { id: string; kind: StoneSessionKind }) => {
  const contribution = useStoneContribution(kind, id);
  const data = contribution.data;
  if (!data || data.level <= data.levelBefore) return null;
  return (
    <div className="mb-6 flex items-center gap-5 border-b pb-6" role="status">
      <RisingStone from={data.levelBefore} to={data.level} />
      <div className="min-w-0">
        <p className="font-heading text-xl leading-snug">{levelTitle(data.level)}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.mastered} itens dominados. A pedra ganhou mais um corte.
        </p>
      </div>
    </div>
  );
};

const GoalPart = ({ goal, counted }: Pick<StoneContribution, "goal" | "counted">) => {
  const before = Math.min(goal.before, goal.target);
  const after = Math.min(goal.after, goal.target);
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between gap-3 text-xs">
        <span className="text-foreground">Meta de hoje</span>
        <span className="text-muted-foreground tabular-nums">
          {goal.after >= goal.target ? "cumprida" : `${goal.after} de ${goal.target}`}
        </span>
      </div>
      <div
        aria-label={`Meta de hoje: ${goal.after} de ${goal.target}${counted ? ", esta sessão contou" : ""}`}
        className="relative h-1.5 overflow-hidden rounded-full bg-muted"
        role="img"
      >
        <span
          className="absolute inset-y-0 left-0 bg-primary/45"
          style={{ width: `${(before / goal.target) * 100}%` }}
        />
        <span
          className="absolute inset-y-0 bg-primary"
          style={{
            left: `${(before / goal.target) * 100}%`,
            width: `${((after - before) / goal.target) * 100}%`,
          }}
        />
      </div>
    </div>
  );
};

const MasteryPart = ({ level, mastered, masteredGained }: StoneContribution) => {
  const current = stoneLevelByNumber(level);
  const next = nextStoneLevel(level);
  const from = Math.min(current.from, mastered);
  return (
    <div className="grid gap-1.5">
      <div className="flex justify-between gap-3 text-xs">
        <span className="text-foreground">
          {masteredGained
            ? `+${masteredGained} ${masteredGained === 1 ? "dominado" : "dominados"}`
            : `${mastered} ${mastered === 1 ? "dominado" : "dominados"}`}
        </span>
        <span className="text-muted-foreground tabular-nums">
          {next
            ? `faltam ${Math.max(0, next.from - mastered)} para o nível ${next.level}`
            : "último nível"}
        </span>
      </div>
      <Progress
        aria-label="Domínio até o próximo nível"
        className={goldBar}
        max={next ? next.from - from : 1}
        value={next ? mastered - from : 1}
      />
    </div>
  );
};

/** Under the result: today's goal before and after, and the mastered items to the next level. */
export const StoneContributionRow = ({ id, kind }: { id: string; kind: StoneSessionKind }) => {
  const contribution = useStoneContribution(kind, id);
  if (!contribution.data) return null;
  return (
    <div className="mt-6 grid gap-4 border-t pt-5 sm:grid-cols-2 sm:gap-6">
      <GoalPart counted={contribution.data.counted} goal={contribution.data.goal} />
      <MasteryPart {...contribution.data} />
    </div>
  );
};
