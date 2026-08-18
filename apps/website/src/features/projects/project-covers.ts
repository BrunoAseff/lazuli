import type { ProjectCoverKey } from "@lazuli/shared";

export type ProjectCover = {
  key: ProjectCoverKey;
  label: string;
  description: string;
  src: string;
};

export const PROJECT_COVERS: ProjectCover[] = [
  {
    key: "library",
    label: "Biblioteca",
    description: "Livros, papéis e luz natural",
    src: "/project-covers/library.webp",
  },
  {
    key: "letters",
    label: "Letras",
    description: "Tipos, símbolos e cartões",
    src: "/project-covers/letters.webp",
  },
  {
    key: "geometry",
    label: "Geometria",
    description: "Formas, linhas e instrumentos",
    src: "/project-covers/geometry.webp",
  },
  {
    key: "orbit",
    label: "Órbita",
    description: "Ondas, órbitas e luz",
    src: "/project-covers/orbit.webp",
  },
  {
    key: "circuits",
    label: "Circuitos",
    description: "Grades e estruturas modulares",
    src: "/project-covers/circuits.webp",
  },
  {
    key: "laboratory",
    label: "Laboratório",
    description: "Vidro, moléculas e transparências",
    src: "/project-covers/laboratory.webp",
  },
  {
    key: "botany",
    label: "Botânica",
    description: "Folhas e estruturas naturais",
    src: "/project-covers/botany.webp",
  },
  {
    key: "atlas",
    label: "Atlas",
    description: "Mapas, relevo e arquivo",
    src: "/project-covers/atlas.webp",
  },
  {
    key: "studio",
    label: "Ateliê",
    description: "Pigmentos, recortes e materiais",
    src: "/project-covers/studio.webp",
  },
  {
    key: "rhythm",
    label: "Ritmo",
    description: "Cordas, ondas e movimento",
    src: "/project-covers/rhythm.webp",
  },
];

export const getProjectCover = (coverKey: ProjectCoverKey | null) =>
  PROJECT_COVERS.find(({ key }) => key === coverKey) ?? null;
