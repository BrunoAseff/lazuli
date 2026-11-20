import { MonitorIcon, MoonIcon, SunIcon } from "@/components/icons.tsx";
import { useTheme } from "next-themes";
import { SettingsSectionHeader, SettingsSurface } from "../components/settings-ui.tsx";
import { RadioCard, RadioGroup } from "@/components/ui/radio-group.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { playChime, setSoundsEnabled, soundsEnabled } from "@/features/stone/level-up-sound.ts";
import { useState } from "react";

const themes = [
  { value: "system", label: "Sistema", icon: MonitorIcon },
  { value: "light", label: "Claro", icon: SunIcon },
  { value: "dark", label: "Escuro", icon: MoonIcon },
] as const;

export default function AppearanceSectionPage() {
  const { theme, setTheme } = useTheme();
  const [sounds, setSounds] = useState(soundsEnabled);
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

      <SettingsSurface className="mt-4" title="Sons">
        <div className="flex items-center justify-between gap-6">
          <label className="text-sm text-muted-foreground" htmlFor="sounds">
            Um som curto quando sua pedra sobe de nível.
          </label>
          <Switch
            checked={sounds}
            id="sounds"
            onCheckedChange={(checked) => {
              setSounds(checked);
              setSoundsEnabled(checked);
              // Turning it on plays it once, so the choice is heard.
              if (checked) playChime();
            }}
          />
        </div>
      </SettingsSurface>
    </div>
  );
}
