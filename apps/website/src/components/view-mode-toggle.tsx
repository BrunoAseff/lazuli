import { Grid2X2Icon, ListIcon } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";

export type ViewMode = "cards" | "table";

export const ViewModeToggle = ({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: ViewMode) => void;
  value: ViewMode;
}) => (
  <div aria-label={label} className="flex border p-0.5" role="group">
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label="Visualizar como cards"
          aria-pressed={value === "cards"}
          onClick={() => onChange("cards")}
          size="icon-sm"
          variant={value === "cards" ? "secondary" : "ghost"}
        >
          <Grid2X2Icon aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Cards</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label="Visualizar como tabela"
          aria-pressed={value === "table"}
          onClick={() => onChange("table")}
          size="icon-sm"
          variant={value === "table" ? "secondary" : "ghost"}
        >
          <ListIcon aria-hidden="true" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Tabela</TooltipContent>
    </Tooltip>
  </div>
);
