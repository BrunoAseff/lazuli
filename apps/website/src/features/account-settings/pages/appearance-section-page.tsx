import { MonitorIcon, MoonIcon, SunIcon } from "@/components/icons.tsx";
import { useTheme } from "next-themes";
import { SettingsSectionHeader, SettingsSurface } from "../components/settings-ui.tsx";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group.tsx";

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
            <RadioCard
              icon={<Icon aria-hidden="true" />}
              key={value}
              layout="tile"
              title={label}
              value={value}
            />
          ))}
        </RadioGroup>
      </SettingsSurface>
    </div>
  );
}
