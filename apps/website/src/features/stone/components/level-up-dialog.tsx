import { STONE_LEVELS, nextStoneLevel, stoneLevelByNumber } from "@lazuli/shared";
import { animate, motion, useAnimationControls, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import { CutGem } from "@/components/brand/cut-gem.tsx";
import { goldBurst } from "@/components/motion/gold-burst.ts";
import { MorphText } from "@/components/motion/morph-text.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog.tsx";
import { cn } from "@/lib/utils.ts";
import { playChime, playTap } from "../level-up-sound.ts";

/*
 * The moment the stone goes up a level. Under 3 seconds, one focus, skippable:
 *   1. the stone at its old cut;
 *   2. three chisel taps: the stone gives a little, a soft tap climbing in pitch;
 *   3. the new cut: the shape turns into the next one with a small swell and a bell, while the
 *      level's name changes letter by letter;
 *   4. a band of light crosses the stone and a few pyrite flecks rise (gold: mastery only);
 *   5. the details settle in (the level, the mastered count, the track, what comes next), then
 *      the way out.
 * A press anywhere jumps to the end. With reduced motion the stone is shown cut, with the bell.
 */

type Stage = "before" | "tapping" | "cut" | "details" | "done";
const order: Stage[] = ["before", "tapping", "cut", "details", "done"];
const reached = (stage: Stage, target: Stage) => order.indexOf(stage) >= order.indexOf(target);

export const LevelUpDialog = ({
  from,
  mastered,
  onOpenChange,
  open,
  to,
}: {
  from: number;
  mastered: number;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  to: number;
}) => {
  const reduced = useReducedMotion();
  const before = stoneLevelByNumber(from);
  const after = stoneLevelByNumber(to);
  const next = nextStoneLevel(to);
  const [stage, setStage] = useState<Stage>("before");
  const [cut, setCut] = useState(before.cut);
  const [glint, setGlint] = useState<number>();
  const stone = useRef<HTMLDivElement>(null);
  // When a press skipped the motion, the click that ends that same press is not "Continuar".
  const skippedAt = useRef(0);
  const press = useAnimationControls();
  const timeline = useRef<{ timers: number[]; stops: Array<() => void> }>({
    timers: [],
    stops: [],
  });

  const stopTimeline = () => {
    timeline.current.timers.forEach((timer) => window.clearTimeout(timer));
    timeline.current.stops.forEach((stop) => stop());
    timeline.current = { timers: [], stops: [] };
  };

  const finish = () => {
    stopTimeline();
    setCut(after.cut);
    setGlint(undefined);
    setStage("done");
  };

  useEffect(() => {
    if (!open) return;
    setStage("before");
    setCut(before.cut);
    setGlint(undefined);
    if (reduced) {
      playChime();
      finish();
      return;
    }
    const at = (ms: number, run: () => void) =>
      timeline.current.timers.push(window.setTimeout(run, ms));
    [420, 620, 820].forEach((ms, step) =>
      at(ms, () => {
        if (step === 0) setStage("tapping");
        playTap(step);
        void press.start({ scale: [1, 0.95, 1], transition: { duration: 0.16, ease: "easeOut" } });
      }),
    );
    at(1050, () => {
      setStage("cut");
      playChime();
      const shape = animate(before.cut, after.cut, {
        duration: 0.9,
        ease: [0.23, 1, 0.32, 1],
        onUpdate: setCut,
      });
      timeline.current.stops.push(() => shape.stop());
      void press.start({
        scale: [1, 1.08, 1],
        transition: { duration: 0.75, ease: [0.23, 1, 0.32, 1], times: [0, 0.35, 1] },
      });
    });
    at(1600, () => {
      const light = animate(0, 1, {
        duration: 0.75,
        ease: "easeInOut",
        onUpdate: setGlint,
        onComplete: () => setGlint(undefined),
      });
      timeline.current.stops.push(() => light.stop());
      if (stone.current) goldBurst(stone.current, 8);
    });
    at(1900, () => setStage("details"));
    at(2400, () => setStage("done"));
    return stopTimeline;
    // The timeline runs once per opening.
  }, [open]);

  const shown = (target: Stage) => reached(stage, target);
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className="gap-0 overflow-hidden px-8 pt-10 pb-7 text-center sm:max-w-sm"
        onPointerDown={() => {
          if (stage === "done") return;
          skippedAt.current = performance.now();
          finish();
        }}
        showCloseButton={false}
      >
        <div className="grid justify-items-center">
          <motion.div
            animate={{ opacity: 1, scale: 1 }}
            initial={reduced ? false : { opacity: 0, scale: 0.85 }}
            ref={stone}
            transition={{ type: "spring", visualDuration: 0.4, bounce: 0 }}
          >
            <motion.div animate={press}>
              <CutGem cut={cut} glint={glint} size={136} />
            </motion.div>
          </motion.div>

          <DialogTitle asChild>
            <h2 className="mt-7 font-heading text-[2rem] leading-tight font-normal">
              <MorphText text={shown("cut") ? after.name : before.name} />
            </h2>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Sua pedra subiu para o nível {after.level}, {after.name}.
          </DialogDescription>

          <motion.p
            animate={{ opacity: shown("details") ? 1 : 0, y: shown("details") ? 0 : 6 }}
            className="mt-2 text-sm text-muted-foreground"
            initial={false}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
          >
            Nível {after.level} · {mastered} itens dominados
          </motion.p>

          {/* The five cuts, the new one lighting up as the details arrive. */}
          <motion.ol
            animate={{ opacity: shown("details") ? 1 : 0 }}
            className="mt-6 flex items-center gap-2"
            initial={false}
            transition={{ duration: 0.35, delay: 0.08 }}
          >
            {STONE_LEVELS.map((item) => {
              const lit =
                item.level < after.level || (item.level === after.level && shown("details"));
              return (
                <li key={item.level}>
                  <motion.span
                    animate={
                      item.level === after.level && shown("details") && !reduced
                        ? { scale: [0.7, 1.15, 1] }
                        : { scale: 1 }
                    }
                    className={cn("block transition-opacity duration-300", !lit && "opacity-35")}
                    transition={{ duration: 0.5, delay: 0.15 }}
                  >
                    <CutGem cut={item.cut} size={22} />
                  </motion.span>
                </li>
              );
            })}
          </motion.ol>

          <motion.p
            animate={{ opacity: shown("details") ? 1 : 0 }}
            className="mt-3 text-xs text-muted-foreground"
            initial={false}
            transition={{ duration: 0.35, delay: 0.16 }}
          >
            {next ? `Próximo: ${next.name}, com ${next.from} dominados` : "O último corte."}
          </motion.p>

          <motion.div
            animate={{ opacity: shown("done") ? 1 : 0, y: shown("done") ? 0 : 6 }}
            // Not pressable until it shows: the tap that skips the motion must not also close.
            className={cn("mt-7 w-full", !shown("done") && "pointer-events-none")}
            inert={!shown("done")}
            initial={false}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
          >
            <Button
              className="w-full"
              onClick={() => {
                if (performance.now() - skippedAt.current < 600) return;
                onOpenChange(false);
              }}
              size="lg"
              tabIndex={shown("done") ? 0 : -1}
            >
              Continuar
            </Button>
          </motion.div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
