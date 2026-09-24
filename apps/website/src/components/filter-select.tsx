import type { ComponentType } from "react";
import { Fragment } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";

export type FilterSelectOption = readonly [
  value: string,
  label: string,
  icon: ComponentType<{ className?: string }>,
];

export const FilterSelect = ({
  label,
  onChange,
  options,
  separatorBefore,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<FilterSelectOption>;
  separatorBefore?: number;
  value: string;
}) => (
  <div className="space-y-2">
    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
    <Select onValueChange={onChange} value={value}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(([optionValue, optionLabel, Icon], index) => (
          <Fragment key={optionValue}>
            {index === separatorBefore && <SelectSeparator />}
            <SelectItem value={optionValue}>
              <Icon className="size-4" /> {optionLabel}
            </SelectItem>
          </Fragment>
        ))}
      </SelectContent>
    </Select>
  </div>
);
