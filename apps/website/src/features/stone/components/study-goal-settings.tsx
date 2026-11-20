import { useState } from "react";

import { PencilIcon } from "@/components/icons.tsx";
import { Button } from "@/components/ui/button.tsx";
import { SettingsSurface } from "@/features/account-settings/components/settings-ui.tsx";
import { useStone } from "../api/stone-queries.ts";
import { goalDaysText, goalText } from "./stone-parts.tsx";
import { StudyGoalDialog } from "./study-goal-dialog.tsx";

/** Settings › Estudo: the same goal as "Sua pedra", for whoever looks for it here. */
export const StudyGoalSettings = () => {
  const stone = useStone();
  const [editing, setEditing] = useState(false);
  if (!stone.data) return null;
  return (
    <SettingsSurface
      action={
        <Button onClick={() => setEditing(true)} size="sm" variant="outline">
          <PencilIcon aria-hidden="true" /> Editar meta
        </Button>
      }
      meta={`${goalText(stone.data.goal)} · ${goalDaysText(stone.data.goal)}`}
      title="Meta diária"
    >
      <p className="max-w-xl text-sm text-muted-foreground">
        O que conta como um dia estudado para a sua pedra. Com menos de 4 dias estudados na semana,
        ela perde o brilho; os dias de folga não contam.
      </p>
      <StudyGoalDialog goal={stone.data.goal} onOpenChange={setEditing} open={editing} />
    </SettingsSurface>
  );
};
