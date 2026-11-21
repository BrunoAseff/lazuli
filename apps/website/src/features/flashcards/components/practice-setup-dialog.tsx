import { Spinner } from "@/components/ui/spinner.tsx";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { ConfirmationDialog } from "@/components/confirmation-dialog.tsx";
import { QuantitySelector } from "@/components/quantity-selector.tsx";
import {
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import {
  practicePaths,
  useCreatePracticeSession,
  usePracticeAvailability,
  type PracticeTarget,
} from "../api/flashcard-queries.ts";
import { getFlashcardCollectionErrorMessage } from "../flashcard-messages.ts";

type SessionSize = 10 | 20 | 50 | 200;
const sizes: Array<{ value: SessionSize; label: string }> = [
  { value: 10, label: "10" },
  { value: 20, label: "20" },
  { value: 50, label: "50" },
  { value: 200, label: "200" },
];

export const PracticeSetupDialog = ({
  collectionId,
  projectId,
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
} & ( // One collection, or the flashcards of every collection in a project.
  | { collectionId: string; projectId?: never }
  | { collectionId?: never; projectId: string }
)) => {
  const navigate = useNavigate();
  const target: PracticeTarget = projectId
    ? { type: "project", id: projectId }
    : { type: "collection", id: collectionId ?? "" };
  const paths = practicePaths(target);
  const availability = usePracticeAvailability(target, open);
  const create = useCreatePracticeSession(target);
  const [size, setSize] = useState<SessionSize>(20);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const active = availability.data?.activeSession;
  const count = Math.min(size, availability.data?.totalAvailable ?? 0);

  const start = async (abandonActive = false) => {
    try {
      const session = await create.mutateAsync({
        id: crypto.randomUUID(),
        size,
        abandonActive,
      });
      onOpenChange(false);
      setConfirmRestart(false);
      void navigate(paths.session(session.id));
    } catch (error) {
      toast.error(getFlashcardCollectionErrorMessage(error, "Não foi possível iniciar a prática."));
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setConfirmRestart(false);
          onOpenChange(next);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preparar prática</DialogTitle>
            <DialogDescription>
              A sessão fica salva. Você pode sair e continuar depois sem perder as respostas
              enviadas.
            </DialogDescription>
          </DialogHeader>
          {availability.isPending ? (
            <div className="flex min-h-36 items-center justify-center">
              <Spinner aria-hidden="true" role="presentation" className="size-5" />
            </div>
          ) : availability.isError ? (
            <div className="border border-dashed p-6 text-center text-sm">
              <p>Não foi possível preparar a prática.</p>
              <Button
                className="mt-3"
                onClick={() => void availability.refetch()}
                variant="outline"
              >
                Tentar novamente
              </Button>
            </div>
          ) : active ? (
            <div className="space-y-5">
              <div className="rounded-[var(--radius)] border bg-muted/35 p-4">
                <p className="font-medium">Há uma prática em andamento</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {active.reviewedCards} de {active.totalCards} flashcards revisados.
                </p>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={create.isPending}
                  onClick={() => setConfirmRestart(true)}
                >
                  Iniciar outra
                </Button>
                <Button
                  onClick={() => {
                    onOpenChange(false);
                    void navigate(paths.session(active.id));
                  }}
                >
                  Continuar prática
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-2">
                <PracticeCount
                  label={{ singular: "Novo", plural: "Novos" }}
                  value={availability.data?.newCards ?? 0}
                />
                <PracticeCount
                  label={{ singular: "Para revisar", plural: "Para revisar" }}
                  value={availability.data?.dueCards ?? 0}
                />
                <PracticeCount
                  label={{ singular: "Disponível", plural: "Disponíveis" }}
                  value={availability.data?.totalAvailable ?? 0}
                />
              </div>
              {/* A limit only matters when there is more to study than the smallest session holds. */}
              {(availability.data?.totalAvailable ?? 0) >
                Math.min(...sizes.map(({ value }) => value)) && (
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">Até quantos flashcards?</legend>
                  <QuantitySelector
                    label="Limite de flashcards"
                    value={size}
                    options={sizes.map((option) => option.value)}
                    onChange={(value) => setSize(value as SessionSize)}
                  />
                </fieldset>
              )}
              <DialogFooter>
                <DialogCancelButton onClick={() => onOpenChange(false)}>
                  Cancelar
                </DialogCancelButton>
                <Button
                  pending={create.isPending}
                  pendingLabel="Preparando"
                  disabled={
                    availability.data?.archived ||
                    !availability.data?.totalAvailable ||
                    create.isPending
                  }
                  onClick={() => void start()}
                >
                  {count > 0
                    ? `Estudar ${count} ${count === 1 ? "flashcard" : "flashcards"}`
                    : "Iniciar prática"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ConfirmationDialog
        open={confirmRestart && open}
        onOpenChange={setConfirmRestart}
        title="Iniciar outra prática?"
        description="A prática atual será encerrada e não poderá ser retomada. As revisões já enviadas continuam no seu histórico."
        actionLabel="Encerrar e iniciar outra"
        pending={create.isPending}
        destructive
        onConfirm={() => start(true)}
      />
    </>
  );
};

const PracticeCount = ({
  label,
  value,
}: {
  label: { singular: string; plural: string };
  value: number;
}) => (
  <div className="grid min-w-0 place-items-center gap-1 px-2 py-2 text-center">
    <p className="whitespace-nowrap text-xs text-muted-foreground">
      {value === 1 ? label.singular : label.plural}
    </p>
    <p className="font-heading text-xl leading-none">{value}</p>
  </div>
);
