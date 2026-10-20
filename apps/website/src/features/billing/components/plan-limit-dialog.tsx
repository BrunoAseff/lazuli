import type { CommercialLimitDetails, CommercialLimitResource } from "@lazuli/shared";
import { FolderPlusIcon } from "@phosphor-icons/react/FolderPlus";
import { HardDriveIcon } from "@phosphor-icons/react/HardDrive";

import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { formatBytes } from "../billing-formatters.ts";
import { useBillingPlans, useBillingSummary } from "../api/billing-queries.ts";

export const PlanLimitDialog = ({
  details,
  onOpenChange,
  onShowPlans,
  open,
  resource,
}: {
  details?: CommercialLimitDetails | null;
  onOpenChange: (open: boolean) => void;
  onShowPlans: () => void;
  open: boolean;
  resource: Exclude<CommercialLimitResource, "credits">;
}) => {
  const summary = useBillingSummary();
  const plans = useBillingPlans();
  const storage = resource === "storage";
  const used =
    details?.usage ?? (storage ? summary.data?.storage.usedBytes : summary.data?.projects.used);
  const limit =
    details?.limit ?? (storage ? summary.data?.storage.limitBytes : summary.data?.projects.limit);
  const nextPlanCode = details?.nextRecommendedPlan ?? summary.data?.nextRecommendedPlan;
  const nextPlan = plans.data?.items.find((plan) => plan.code === nextPlanCode);
  const Icon = storage ? HardDriveIcon : FolderPlusIcon;
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <span className="grid size-10 place-items-center rounded-[var(--radius)] bg-primary/10 text-primary">
            <Icon className="size-5" weight="duotone" />
          </span>
          <DialogTitle>
            {storage ? "Limite de armazenamento atingido" : "Limite de projetos atingido"}
          </DialogTitle>
          <DialogDescription>
            {storage
              ? `Você já utilizou ${formatBytes(used ?? 0)} dos ${formatBytes(limit ?? 0)} disponíveis no seu plano. O envio não foi realizado e, ao fechar esta janela, a seleção será descartada. Libere espaço ou faça upgrade antes de tentar novamente.`
              : `Seu plano permite ${limit ?? 0} projetos e esse limite já foi utilizado. O projeto de exemplo não entra nessa contagem.`}
          </DialogDescription>
          {nextPlan && (
            <p className="text-sm text-muted-foreground">
              O plano {nextPlan.name} oferece{" "}
              {storage
                ? `${formatBytes(nextPlan.storageLimitBytes)} de armazenamento`
                : nextPlan.projectLimit === null
                  ? "projetos ilimitados"
                  : `${nextPlan.projectLimit} projetos`}
              .
            </p>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Agora não
          </Button>
          <Button onClick={onShowPlans}>Ver planos</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
