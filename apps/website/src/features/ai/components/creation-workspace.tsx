import { motion, useReducedMotion } from "motion/react";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ArrowRightIcon, ChevronDownIcon } from "@/components/icons.tsx";
import { Collapsible } from "radix-ui";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { useIsMobile } from "@/hooks/use-mobile.ts";
import { SourceReadingContext } from "@/features/references/components/source-reading-context.ts";
import "./creation-workspace.css";

/** The source stays in place while the material progresses from setup to review. */
export function CreationWorkspace({
  source,
  sourceLabel = "Fonte",
  reviewing = false,
  composing = false,
  destinationLabel = "Seu material",
  sourceControls = false,
  children,
}: {
  source: ReactNode;
  sourceLabel?: string;
  reviewing?: boolean;
  composing?: boolean;
  destinationLabel?: string;
  sourceControls?: boolean;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const mobile = useIsMobile();
  const [sourceOpen, setSourceOpen] = useState(sourceControls);
  const [immediate, setImmediate] = useState(false);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [claimName, setClaimName] = useState<string | null>(null);
  const claimed = claimName !== null;
  // A pane taken over for navigation starts closed on mobile so the item being edited stays in view.
  const claim = useCallback((name: string | null) => {
    setClaimName(name);
    if (name !== null) setSourceOpen(false);
  }, []);
  const collapse = useCallback(() => setSourceOpen(false), []);
  const reading = useMemo(
    () => ({ fill: !mobile, slot, claim, collapse }),
    [mobile, slot, claim, collapse],
  );
  return (
    <SourceReadingContext value={reading}>
      <div className="creation-workspace">
        <Collapsible.Root asChild open={!mobile || sourceOpen} onOpenChange={setSourceOpen}>
          <aside
            className="creation-origin"
            data-claimed={claimed || undefined}
            data-controls={sourceControls || undefined}
          >
            <div
              className={cn(
                "creation-region-label flex items-center justify-between gap-3",
                claimed && !mobile && "hidden",
              )}
            >
              {!claimed && <span>{sourceLabel}</span>}
              {mobile && (
                <Collapsible.Trigger asChild>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={(event) => setImmediate(event.detail === 0)}
                  >
                    {claimed ? claimName : sourceOpen ? "Recolher" : "Consultar"}
                    <ChevronDownIcon
                      aria-hidden="true"
                      className={sourceOpen ? "rotate-180" : undefined}
                    />
                  </Button>
                </Collapsible.Trigger>
              )}
            </div>
            <Collapsible.Content
              className="creation-origin-body"
              data-immediate={immediate || reduced}
            >
              <div className="creation-origin-content">
                <div ref={setSlot} />
                {!claimed && source}
              </div>
            </Collapsible.Content>
          </aside>
        </Collapsible.Root>
        <section
          className="creation-destination"
          aria-label={
            composing ? destinationLabel : reviewing ? "Revisar materiais" : "Preparar materiais"
          }
        >
          {composing ? (
            <div className="creation-region-label">{destinationLabel}</div>
          ) : reviewing ? null : (
            <ol className="creation-stages" aria-label="Etapas da criação">
              <li aria-current={!reviewing ? "step" : undefined}>Preparar</li>
              <li aria-hidden="true">
                <ArrowRightIcon className="size-3.5" />
              </li>
              <li aria-current={reviewing ? "step" : undefined}>Revisar e salvar</li>
            </ol>
          )}
          <motion.div
            key={reviewing ? "review" : "prepare"}
            initial={reduced ? false : { opacity: 0, transform: "translateX(12px)" }}
            animate={{ opacity: 1, transform: "translateX(0px)" }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="creation-fields"
          >
            {children}
          </motion.div>
        </section>
      </div>
    </SourceReadingContext>
  );
}
