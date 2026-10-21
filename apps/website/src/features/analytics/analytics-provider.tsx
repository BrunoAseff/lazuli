import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { analyticsConfigured, disableAnalytics, enableAnalytics } from "./analytics-client.ts";
import { useAnalyticsPreference, useUpdateAnalyticsPreference } from "./api/analytics-queries.ts";

type AnalyticsContextValue = {
  openPreferences: () => void;
};

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

export const useAnalyticsSettings = () => {
  const value = useContext(AnalyticsContext);
  if (!value) throw new Error("useAnalyticsSettings must be used within AnalyticsProvider");
  return value;
};

export const AnalyticsProvider = ({
  children,
  userId,
}: {
  children: ReactNode;
  userId: string;
}) => {
  const preference = useAnalyticsPreference(userId);
  const updatePreference = useUpdateAnalyticsPreference(userId);
  const [preferencesOpen, setPreferencesOpen] = useState(false);

  useEffect(() => {
    if (userId && preference.data?.status === "granted") enableAnalytics(userId);
    else disableAnalytics();
    return disableAnalytics;
  }, [preference.data?.status, userId]);

  const choose = async (status: "granted" | "denied") => {
    try {
      await updatePreference.mutateAsync({ status });
    } catch {
      toast.error("Não foi possível salvar sua preferência. Tente novamente.");
    }
  };

  const context = useMemo(() => ({ openPreferences: () => setPreferencesOpen(true) }), []);
  const undecided = analyticsConfigured && preference.data?.status === "undecided";

  return (
    <AnalyticsContext.Provider value={context}>
      {children}
      {undecided && (
        <aside className="fixed inset-x-3 bottom-3 z-50 mx-auto grid max-w-xl gap-3 rounded-[var(--radius-overlay)] border bg-popover p-4 text-sm shadow-lg sm:grid-cols-[1fr_auto] sm:items-center">
          <p className="text-muted-foreground">
            Para melhorar o Lazúli, coletamos métricas de uso vinculadas à sua conta e informações
            técnicas do dispositivo. Não coletamos seu nome, e-mail nem seus materiais.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              disabled={updatePreference.isPending}
              onClick={() => void choose("denied")}
              variant="outline"
            >
              Não permitir
            </Button>
            <Button disabled={updatePreference.isPending} onClick={() => void choose("granted")}>
              Permitir
            </Button>
          </div>
        </aside>
      )}
      <Dialog
        open={preferencesOpen}
        onOpenChange={(open) => !updatePreference.isPending && setPreferencesOpen(open)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Métricas de uso</DialogTitle>
            <DialogDescription>
              Quando permitido, coletamos métricas de uso vinculadas à sua conta sem incluir nome ou
              e-mail, além de informações técnicas do dispositivo e navegador. Seus materiais não
              são coletados.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-4 rounded-[var(--radius)] border bg-muted/35 px-3 py-3">
            <Label className="cursor-pointer" htmlFor="analytics-preference">
              Permitir métricas de uso
            </Label>
            <Switch
              checked={preference.data?.status === "granted"}
              disabled={preference.isPending || preference.isError || updatePreference.isPending}
              id="analytics-preference"
              onCheckedChange={(checked) => void choose(checked ? "granted" : "denied")}
            />
          </div>
        </DialogContent>
      </Dialog>
    </AnalyticsContext.Provider>
  );
};
