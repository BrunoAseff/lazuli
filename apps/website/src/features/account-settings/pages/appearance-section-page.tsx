import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { SettingsSectionHeader, SettingsSurface } from "../components/settings-ui.tsx";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group.tsx";

const themes = [
  { value: "system", label: "Sistema", icon: MonitorIcon },
  { value: "light", label: "Claro", icon: SunIcon },
  { value: "dark", label: "Escuro", icon: MoonIcon },
] as const;

export default function AppearanceSectionPage() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <SettingsSectionHeader title="Aparência" />
      <SettingsSurface title="Tema">
        <RadioGroup
          aria-label="Tema"
          className="grid-cols-3 gap-3 pt-2"
          value={theme ?? "system"}
          onValueChange={setTheme}
        >
          {themes.map(({ value, label, icon: Icon }) => (
            <RadioGroupItem
              key={value}
              value={value}
              className="relative flex h-24 w-full flex-col items-center justify-center gap-2 rounded-lg border-border bg-background text-sm text-foreground transition-colors hover:bg-muted disabled:pointer-events-none data-[state=checked]:bg-[var(--primary-soft)] data-[state=checked]:text-primary"
            >
              <Icon aria-hidden="true" className="size-5" />
              {label}
              {theme === value && (
                <CheckIcon aria-hidden="true" className="absolute top-2 right-2 size-3.5" />
              )}
            </RadioGroupItem>
          ))}
        </RadioGroup>
      </SettingsSurface>
    </div>
  );
}
