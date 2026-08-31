import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import type { FlashcardPracticeSession, FlashcardRating } from "@lazuli/shared";
import { ArrowLeftIcon, LoaderCircleIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import { releaseResolvedAssetUrls, resolveAssetUrl } from "@/features/assets/asset-api.ts";
import { lazuliBlockNoteDictionary } from "@/features/documents/editor/blocknote-dictionary.ts";
import {
  documentSchema,
  type LazuliDocumentBlock,
} from "@/features/documents/editor/document-schema.tsx";
import { cn } from "@/lib/utils.ts";
import { MaterialReferencesButton } from "@/features/references/components/material-references-dialog.tsx";
import {
  usePracticeAvailability,
  useFlashcardCollection,
  usePracticeSession,
  useSubmitPracticeReview,
} from "../api/flashcard-queries.ts";
import { getFlashcardCollectionErrorMessage } from "../flashcard-messages.ts";
import { PracticeSetupDialog } from "../components/practice-setup-dialog.tsx";

const ratings: Array<{
  value: FlashcardRating;
  label: string;
  help: string;
  key: string;
}> = [
  { value: "again", label: "Repetir", help: "Não lembrei", key: "1" },
  { value: "hard", label: "Difícil", help: "Lembrei com bastante esforço", key: "2" },
  { value: "good", label: "Bom", help: "Lembrei com esforço normal", key: "3" },
  { value: "easy", label: "Fácil", help: "Lembrei imediatamente", key: "4" },
];

const formatInterval = (seconds: number) => {
  if (seconds < 60) return "agora";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} mês${months === 1 ? "" : "es"}`;
  const years = Math.round(days / 365);
  return `${years} ano${years === 1 ? "" : "s"}`;
};

const isEditableTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

export default function FlashcardPracticePage() {
  const { collectionId = "", sessionId = "" } = useParams();
  const navigate = useNavigate();
  const practice = usePracticeSession(sessionId);
  const submit = useSubmitPracticeReview(sessionId, collectionId);
  const [revealed, setRevealed] = useState(false);
  const [failedRating, setFailedRating] = useState<FlashcardRating | null>(null);
  const reviewAttempt = useRef<{
    itemId: string;
    rating: FlashcardRating;
    reviewId: string;
  } | null>(null);
  const itemId = practice.data?.currentItem?.id;

  useEffect(() => {
    setRevealed(false);
    setFailedRating(null);
    reviewAttempt.current = null;
  }, [itemId]);
  useEffect(() => () => releaseResolvedAssetUrls(), []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || submit.isPending || !practice.data?.currentItem) return;
      if (event.code === "Space" && !revealed) {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      if (revealed && ["1", "2", "3", "4"].includes(event.key)) {
        event.preventDefault();
        const rating = ratings[Number(event.key) - 1];
        if (rating && (!failedRating || failedRating === rating.value)) void review(rating.value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [failedRating, practice.data?.currentItem, revealed, submit.isPending]);

  const review = async (rating: FlashcardRating) => {
    if (!itemId) return;
    const attempt =
      reviewAttempt.current?.itemId === itemId
        ? reviewAttempt.current
        : { itemId, rating, reviewId: crypto.randomUUID() };
    reviewAttempt.current = attempt;
    try {
      await submit.mutateAsync({
        id: attempt.reviewId,
        itemId: attempt.itemId,
        rating: attempt.rating,
      });
      reviewAttempt.current = null;
      setFailedRating(null);
      setRevealed(false);
      if (rating === "again") toast.info("O card voltou para o fim da fila desta sessão.");
    } catch (error) {
      setFailedRating(attempt.rating);
      toast.error(
        getFlashcardCollectionErrorMessage(error, "Não foi possível registrar sua resposta."),
      );
    }
  };

  if (practice.isPending)
    return (
      <main className="flex min-h-[70vh] items-center justify-center">
        <LoaderCircleIcon className="size-6 animate-spin" />
      </main>
    );
  if (practice.isError || !practice.data)
    return (
      <main className="mx-auto w-full max-w-3xl px-5 py-12 text-center">
        <h1 className="font-heading text-3xl">Prática não encontrada</h1>
        <Button asChild className="mt-5" variant="outline">
          <Link to={`/flashcards/${collectionId}`}>Voltar à coleção</Link>
        </Button>
      </main>
    );

  const session = practice.data;
  if (session.status !== "active" || !session.currentItem)
    return <PracticeSummary collectionId={collectionId} session={session} />;
  const progress = session.totalCards
    ? Math.round((session.reviewedCards / session.totalCards) * 100)
    : 0;

  return (
    <main className="flex min-h-[calc(100vh-2px)] flex-1 flex-col px-5 py-7 sm:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-4 border-b pb-5">
        <Button
          aria-label="Sair da prática"
          onClick={() => navigate(`/flashcards/${collectionId}`)}
          size="icon-sm"
          variant="ghost"
        >
          <ArrowLeftIcon />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{session.collectionTitle}</p>
          <p className="text-xs text-muted-foreground">
            {session.reviewedCards} de {session.totalCards} revisados
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          Espaço para revelar · 1–4 para avaliar
        </span>
      </div>
      <Progress
        aria-label={`${session.reviewedCards} de ${session.totalCards} flashcards revisados`}
        className="mx-auto mt-4 h-1 w-full max-w-5xl"
        value={progress}
      />
      <div className="mx-auto flex w-full max-w-3xl flex-col pt-12 pb-10 sm:pt-16">
        <section aria-labelledby="question-title">
          <p
            className="mb-5 text-center text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase"
            id="question-title"
          >
            Pergunta
          </p>
          <RichContent content={session.currentItem.card.question as LazuliDocumentBlock} />
        </section>
        {!revealed ? (
          <Button className="mx-auto mt-10 min-w-52" onClick={() => setRevealed(true)} size="lg">
            Mostrar resposta
          </Button>
        ) : (
          <>
            <div className="my-9 border-t" />
            <section aria-labelledby="answer-title">
              <p
                className="mb-5 text-center text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase"
                id="answer-title"
              >
                Resposta
              </p>
              <RichContent content={session.currentItem.card.answer as LazuliDocumentBlock} />
            </section>
            <TooltipProvider delayDuration={300}>
              <div className="mt-10 grid gap-2 sm:grid-cols-4">
                {ratings.map((rating) => {
                  const preview = session.currentItem!.intervals.find(
                    ({ rating: value }) => value === rating.value,
                  );
                  return (
                    <Tooltip key={rating.value}>
                      <TooltipTrigger asChild>
                        <Button
                          className={cn(
                            "h-auto flex-col gap-0.5 py-3",
                            rating.value === "again" && "text-destructive",
                          )}
                          disabled={
                            submit.isPending ||
                            (failedRating !== null && failedRating !== rating.value)
                          }
                          onClick={() => void review(rating.value)}
                          variant="outline"
                        >
                          <span>
                            {rating.key} ·{" "}
                            {failedRating === rating.value ? "Tentar novamente" : rating.label}
                          </span>
                          <span className="text-xs font-normal text-muted-foreground">
                            {preview ? formatInterval(preview.intervalSeconds) : "—"}
                          </span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent sideOffset={6}>{rating.help}</TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </TooltipProvider>
          </>
        )}
      </div>
    </main>
  );
}

const RichContent = ({ content }: { content: LazuliDocumentBlock }) => {
  const editor = useCreateBlockNote(
    {
      schema: documentSchema,
      initialContent: content,
      dictionary: lazuliBlockNoteDictionary,
      resolveFileUrl: resolveAssetUrl,
    },
    [content],
  );
  return (
    <BlockNoteView
      className="lazuli-editor lazuli-flashcard-practice"
      editable={false}
      editor={editor}
      theme="light"
    />
  );
};

const PracticeSummary = ({
  collectionId,
  session,
}: {
  collectionId: string;
  session: FlashcardPracticeSession;
}) => {
  const availability = usePracticeAvailability(collectionId);
  const collection = useFlashcardCollection(collectionId);
  const [setupOpen, setSetupOpen] = useState(false);
  const correct = session.ratings.hard + session.ratings.good + session.ratings.easy;
  const completed = session.status === "completed";
  return (
    <main className="mx-auto flex min-h-[75vh] w-full max-w-3xl flex-col justify-center px-5 py-12 text-center">
      <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
        {completed ? "Sessão concluída" : "Sessão encerrada"}
      </p>
      <h1 className="mt-3 font-heading text-4xl sm:text-5xl">
        {completed ? "Prática finalizada" : "Prática encerrada"}
      </h1>
      <p className="mt-3 text-muted-foreground">
        Você revisou {session.reviewedCards} flashcards. {correct} foram lembrados corretamente.
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {collection.data?.dueCards
          ? `${collection.data.dueCards} flashcards ainda estão disponíveis.`
          : collection.data?.nextPracticeAt
            ? `Próxima revisão em ${new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(collection.data.nextPracticeAt))}.`
            : "Nenhuma outra revisão está agendada."}
      </p>
      <div className="mt-8 grid grid-cols-4 gap-px border bg-border text-left">
        {ratings.map((rating) => (
          <div className="bg-background p-4" key={rating.value}>
            <p className="font-heading text-2xl">{session.ratings[rating.value]}</p>
            <p className="text-xs text-muted-foreground">{rating.label}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        <Button asChild variant="outline">
          <Link to={`/flashcards/${collectionId}`}>Voltar à coleção</Link>
        </Button>
        <Button disabled={!availability.data?.totalAvailable} onClick={() => setSetupOpen(true)}>
          {availability.data?.totalAvailable ? "Praticar mais" : "Nada pendente agora"}
        </Button>
      </div>
      {session.reviewedMaterials.some(({ referenceCount }) => referenceCount > 0) && (
        <section className="mt-10 border-t pt-7 text-left">
          <h2 className="font-heading text-2xl">Fontes dos flashcards revisados</h2>
          <div className="mt-4 divide-y border-y">
            {session.reviewedMaterials
              .filter(({ referenceCount }) => referenceCount > 0)
              .map((card) => (
                <div className="flex min-w-0 items-center gap-4 py-3" key={card.id}>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">
                    {card.questionText || "Flashcard com imagem"}
                  </p>
                  <MaterialReferencesButton
                    count={card.referenceCount}
                    target={{ id: card.id, type: "flashcard" }}
                  />
                </div>
              ))}
          </div>
        </section>
      )}
      <PracticeSetupDialog
        collectionId={collectionId}
        onOpenChange={setSetupOpen}
        open={setupOpen}
      />
    </main>
  );
};
