import SegmentedControl from "@/components/arc/segmented-control/segmented-control.tsx";
import "@/components/arc/foundation.css";

/** The same immediate view-selection behavior in charts and material libraries. */
export const ViewSelector = ({
  label,
  options,
  value,
  onChange,
  fullWidth = false,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  fullWidth?: boolean;
}) => (
  <SegmentedControl
    className="arc-control"
    label={label}
    options={options}
    value={value}
    onValueChange={onChange}
    fullWidth={fullWidth}
  />
);
