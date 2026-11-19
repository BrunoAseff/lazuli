import type { DashboardResponse, DashboardOnboardingStepId } from "@lazuli/shared";
import { CheckIcon, ChevronRightIcon, XIcon } from "@/components/icons.tsx";
import { Link } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { useDismissDashboardOnboarding } from "../api/dashboard-queries.ts";
import { DashboardSectionTitle } from "./dashboard-section-title.tsx";

const stepCopy: Record<
  DashboardOnboardingStepId,
  { description: string; label: string; title: string }
> = {
  "create-document": {
    title: "Adicione seu material",
    description: "Crie um projeto e escreva ou importe um documento próprio.",
    label: "Adicionar material",
  },
  "generate-material": {
    title: "Prepare a prática",
    description: "Use uma fonte própria para gerar flashcards ou questões com IA.",
    label: "Gerar material",
  },
  "approve-material": {
    title: "Revise antes de salvar",
    description: "Confira a proposta e salve somente o material que fizer sentido.",
    label: "Revisar proposta",
  },
  "complete-practice": {
    title: "Pratique e retorne",
    description: "Conclua uma prática para iniciar seu histórico de aprendizagem.",
    label: "Começar prática",
  },
};

export const DashboardOnboarding = ({
  onboarding,
}: {
  onboarding: DashboardResponse["onboarding"];
}) => {
  const dismiss = useDismissDashboardOnboarding();
  const firstIncompleteIndex = onboarding.steps.findIndex(({ completed }) => !completed);
  const currentStep = onboarding.steps[firstIncompleteIndex];
  if (!currentStep) return null;
  const copy = stepCopy[currentStep.id];
  const handleDismiss = async () => {
    try {
      await dismiss.mutateAsync();
    } catch {
      toast.error("Não foi possível ocultar esta orientação. Tente novamente.");
    }
  };

  return (
    <section
      aria-labelledby="dashboard-onboarding-title"
      className="surface-panel flex flex-col p-6"
    >
      <DashboardSectionTitle
        action={
          <Button
            aria-label="Ocultar orientação"
            disabled={dismiss.isPending}
            onClick={() => void handleDismiss()}
            size="icon"
            variant="ghost"
          >
            <XIcon aria-hidden="true" />
          </Button>
        }
        id="dashboard-onboarding-title"
        title="Primeiros passos"
      />

      <ol className="mt-7 grid gap-x-7 gap-y-5 sm:grid-cols-2">
        {onboarding.steps.map((step, index) => {
          const stepContent = stepCopy[step.id];
          const current = index === firstIncompleteIndex;
          return (
            <li aria-current={current ? "step" : undefined} className="flex gap-3" key={step.id}>
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-muted-foreground shadow-[inset_0_0_0_1px_var(--input)]",
                  step.completed && "bg-success text-success-foreground shadow-none",
                  current && "bg-action text-action-foreground shadow-none",
                )}
              >
                {step.completed ? <CheckIcon aria-hidden="true" className="size-4" /> : index + 1}
              </span>
              <span className="min-w-0 pt-0.5">
                <span className="block font-medium">{stepContent.title}</span>
                {current && (
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                    {stepContent.description}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      <div className="mt-auto flex justify-end pt-7">
        <Button asChild>
          <Link to={currentStep.href}>
            {copy.label}
            <ChevronRightIcon aria-hidden="true" data-icon="inline-end" />
          </Link>
        </Button>
      </div>
    </section>
  );
};
