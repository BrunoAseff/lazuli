import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { disableAnalytics, enableAnalytics } from "./analytics-client.ts";
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
      setPreferencesOpen(false);
    } catch {
      toast.error("Não foi possível salvar sua preferência. Tente novamente.");
    }
  };

  const context = useMemo(() => ({ openPreferences: () => setPreferencesOpen(true) }), []);
  const undecided = preference.data?.status === "undecided";

  return (
    <AnalyticsContext.Provider value={context}>
      {children}
      {undecided && (
        <aside className="fixed inset-x-3 bottom-3 z-50 mx-auto grid max-w-xl gap-3 rounded-[var(--radius-overlay)] border bg-popover p-4 text-sm shadow-lg sm:grid-cols-[1fr_auto] sm:items-center">
          <p className="text-muted-foreground">
            Podemos coletar eventos de uso associados ao ID interno da sua conta para melhorar o
            Lazúli. Não enviamos nome, e-mail, URLs nem conteúdo de estudo.
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
              Quando permitido, enviamos somente eventos de uso associados ao ID interno da conta.
              Não enviamos nome, e-mail, URLs nem conteúdo de estudo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AnalyticsContext.Provider>
  );
};
