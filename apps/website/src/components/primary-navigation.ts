import { ChartBarIcon, GemIcon, HouseIcon } from "@/components/icons.tsx";
import {
  FlashcardDomainIcon,
  ProjectClosedIcon,
  QuizDomainIcon,
} from "@/components/domain-icons.ts";

/** Destinations shared by the sidebar and the global search's "Ir para" group. */
export const primaryNavigation = [
  { label: "Início", path: "/dashboard", Icon: HouseIcon },
  // The page lists projects; documents live inside them.
  { label: "Projetos", path: "/documents", Icon: ProjectClosedIcon },
  { label: "Flashcards", path: "/flashcards", Icon: FlashcardDomainIcon },
  { label: "Quizzes", path: "/quizzes", Icon: QuizDomainIcon },
  { label: "Estatísticas", path: "/statistics", Icon: ChartBarIcon },
  { label: "Sua pedra", path: "/stone", Icon: GemIcon },
] as const;
