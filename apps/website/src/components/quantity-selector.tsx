import { ViewSelector } from "./view-selector.tsx";

/** Discrete amounts use the same selection, focus and motion contract as view controls. */
export function QuantitySelector({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly number[];
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <ViewSelector
      fullWidth
      label={label}
      value={String(value)}
      options={options.map((option) => ({ value: String(option), label: String(option) }))}
      onChange={(next) => {
        const amount = Number(next);
        if (options.includes(amount)) onChange(amount);
      }}
    />
  );
}
