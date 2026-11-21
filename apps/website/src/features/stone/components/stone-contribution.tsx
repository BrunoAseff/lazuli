import {
  nextStoneLevel,
  stoneLevelByNumber,
  type StoneContribution,
  type StoneSessionKind,
} from "@lazuli/shared";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import { motionTokens } from "@/components/arc/motion-tokens.ts";

import { ForwardLink } from "@/components/nav-link.tsx";
import { useStoneContribution } from "../api/stone-queries.ts";
import { LevelUpDialog } from "./level-up-dialog.tsx";
import { FillingProgress, goldBar } from "./stone-parts.tsx";

/* What a practice or quiz added, shown in its summary: the goal of today and the mastery. */

const shownKey = (kind: StoneSessionKind, id: string) => `lazuli:level-up:${kind}:${id}`;

/**
 * The level-up moment, over the summary of the session that raised the level: it opens by itself,
 * once, and only right after the session (an old summary opened later does not replay it).
 */
export const StoneLevelUp = ({ id, kind }: { id: string; kind: StoneSessionKind }) => {
  const contribution = useStoneContribution(kind, id);
  const data = contribution.data;
  const [closed, setClosed] = useState(() => {
    try {
      return window.localStorage.getItem(shownKey(kind, id)) === "1";
    } catch {
      return false;
    }
  });
  if (!data || !data.fresh || data.level <= data.levelBefore || closed) return null;
  return (
    <LevelUpDialog
      from={data.levelBefore}
      mastered={data.mastered}
      onOpenChange={(open) => {
        if (open) return;
        try {
          window.localStorage.setItem(shownKey(kind, id), "1");
        } catch {
          // Without storage, it could show again on a later visit to this summary.
        }
        setClosed(true);
      }}
      open
      to={data.level}
    />
  );
};

const GoalPart = ({ goal, counted }: Pick<StoneContribution, "goal" | "counted">) => {
  const reduced = useReducedMotion();
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
        {/* This session's part grows in after the rest is shown. */}
        <motion.span
          animate={{ width: `${((after - before) / goal.target) * 100}%` }}
          className="absolute inset-y-0 bg-primary"
          initial={reduced ? false : { width: "0%" }}
          style={{ left: `${(before / goal.target) * 100}%` }}
          transition={{ ...motionTokens.spring.smooth, delay: 0.35 }}
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
      <FillingProgress
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
    <div className="mt-8">
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
        <GoalPart counted={contribution.data.counted} goal={contribution.data.goal} />
        <MasteryPart {...contribution.data} />
      </div>
      <div className="mt-3 flex justify-end">
        <ForwardLink to="/stone">Ver sua pedra</ForwardLink>
      </div>
    </div>
  );
};
