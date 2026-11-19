import { ViewSelector } from "@/components/view-selector.tsx";

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
  <ViewSelector
    label={label}
    value={value}
    onChange={(next) => onChange(next as ViewMode)}
    options={[
      { value: "cards", label: "Cards" },
      { value: "table", label: "Tabela" },
    ]}
  />
);
