import { ChartBarIcon, HouseIcon } from "@/components/icons.tsx";
import {
  DocumentDomainIcon,
  FlashcardDomainIcon,
  QuizDomainIcon,
} from "@/components/domain-icons.ts";

/** Destinations shared by the sidebar and the global search's "Ir para" group. */
export const primaryNavigation = [
  { label: "Início", path: "/dashboard", Icon: HouseIcon },
  { label: "Documentos", path: "/documents", Icon: DocumentDomainIcon },
  { label: "Flashcards", path: "/flashcards", Icon: FlashcardDomainIcon },
  { label: "Quizzes", path: "/quizzes", Icon: QuizDomainIcon },
  { label: "Estatísticas", path: "/statistics", Icon: ChartBarIcon },
] as const;
