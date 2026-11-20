import type { StoneResponse } from "@lazuli/shared";

import { ForwardLink } from "@/components/nav-link.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useStone } from "../api/stone-queries.ts";
import { GoalLine, levelTitle, MasteryLine, StoneGem, WeekLine } from "./stone-parts.tsx";

/** The home card: the stone, its level, today's goal and the week. Opens "Sua pedra". */
export const StoneCard = () => {
  const stone = useStone();
  if (stone.isPending)
    return (
      <div aria-busy="true" className="flex items-center gap-5">
        <Skeleton className="size-[76px] shrink-0 rounded-[var(--radius-panel)]" />
        <div className="grid flex-1 gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-1.5 w-full" />
          <Skeleton className="h-1.5 w-full" />
        </div>
      </div>
    );
  // The rest of the home page works without the stone; a failure only hides it.
  if (stone.isError || !stone.data) return null;
  return <StoneCardView link stone={stone.data} />;
};

/** The card itself, also shown with example data on the public page (without the link). */
export const StoneCardView = ({
  link = false,
  stone,
}: {
  link?: boolean;
  stone: StoneResponse;
}) => (
  <section aria-labelledby="stone-card-title" className="flex items-center gap-5">
    <StoneGem dull={stone.dull} level={stone.level} size={76} />
    <div className="grid min-w-0 flex-1 gap-4">
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold" id="stone-card-title">
            Sua pedra
          </h2>
          {link && <ForwardLink to="/stone">Ver sua pedra</ForwardLink>}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{levelTitle(stone.level)}</p>
      </div>
      <MasteryLine level={stone.level} mastered={stone.mastered} />
      <GoalLine stone={stone} />
      <WeekLine stone={stone} />
    </div>
  </section>
);
