import { LoaderCircleIcon } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogCancelButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { cn } from "@/lib/utils.ts";
import { useCreatePracticeSession, usePracticeAvailability } from "../api/flashcard-queries.ts";
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
  onOpenChange,
  open,
}: {
  collectionId: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  const navigate = useNavigate();
  const availability = usePracticeAvailability(collectionId, open);
  const create = useCreatePracticeSession(collectionId);
  const [size, setSize] = useState<SessionSize>(20);
  const active = availability.data?.activeSession;

  const start = async (abandonActive = false) => {
    try {
      const session = await create.mutateAsync({
        id: crypto.randomUUID(),
        size,
        abandonActive,
      });
      onOpenChange(false);
      void navigate(`/flashcards/${collectionId}/practice/${session.id}`);
    } catch (error) {
      toast.error(getFlashcardCollectionErrorMessage(error, "Não foi possível iniciar a prática."));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Preparar prática</DialogTitle>
          <DialogDescription>
            A sessão fica salva. Você pode sair e continuar depois sem perder as respostas enviadas.
          </DialogDescription>
        </DialogHeader>
        {availability.isPending ? (
          <div className="flex min-h-36 items-center justify-center">
            <LoaderCircleIcon className="size-5 animate-spin" />
          </div>
        ) : availability.isError ? (
          <div className="border border-dashed p-6 text-center text-sm">
            <p>Não foi possível preparar a prática.</p>
            <Button className="mt-3" onClick={() => void availability.refetch()} variant="outline">
              Tentar novamente
            </Button>
          </div>
        ) : active ? (
          <div className="space-y-5">
            <div className="border bg-muted/35 p-4">
              <p className="font-medium">Há uma prática em andamento</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {active.reviewedCards} de {active.totalCards} flashcards revisados.
              </p>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  onOpenChange(false);
                  void navigate(`/flashcards/${collectionId}/practice/${active.id}`);
                }}
                variant="outline"
              >
                Continuar prática
              </Button>
              <Button disabled={create.isPending} onClick={() => void start(true)}>
                Abandonar e iniciar nova
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-px border bg-border">
              <PracticeCount
                label={{ singular: "Novo", plural: "Novos" }}
                value={availability.data?.newCards ?? 0}
              />
              <PracticeCount
                label={{ singular: "Vencido", plural: "Vencidos" }}
                value={availability.data?.dueCards ?? 0}
              />
              <PracticeCount
                label={{ singular: "Disponível", plural: "Disponíveis" }}
                value={availability.data?.totalAvailable ?? 0}
              />
            </div>
            <fieldset>
              <legend className="mb-2 text-sm font-medium">Tamanho da sessão</legend>
              <div className="grid grid-cols-4 gap-2">
                {sizes.map((option) => (
                  <button
                    aria-pressed={size === option.value}
                    className={cn(
                      "border px-3 py-2 text-sm transition-colors hover:bg-muted",
                      size === option.value && "border-foreground bg-muted font-medium",
                    )}
                    key={option.label}
                    onClick={() => setSize(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>
            <DialogFooter>
              <DialogCancelButton onClick={() => onOpenChange(false)}>Cancelar</DialogCancelButton>
              <Button
                disabled={
                  availability.data?.archived ||
                  !availability.data?.totalAvailable ||
                  create.isPending
                }
                onClick={() => void start()}
              >
                {create.isPending && <LoaderCircleIcon className="animate-spin" />}
                Iniciar prática
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

const PracticeCount = ({
  label,
  value,
}: {
  label: { singular: string; plural: string };
  value: number;
}) => (
  <div className="bg-background p-3 text-center">
    <p className="font-heading text-2xl">{value}</p>
    <p className="text-xs text-muted-foreground">{value === 1 ? label.singular : label.plural}</p>
  </div>
);
