export const foldSearchText = (value: string) =>
  value.normalize("NFD").replaceAll(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");

/** "1 flashcard", "3 questões", "Nenhum resultado" for narrowed lists. */
export const resultCount = (count: number, singular: string, plural: string) =>
  count === 0 ? "Nenhum resultado" : `${count} ${count === 1 ? singular : plural}`;

/** Names generated or saved items by what they are: "1 flashcard", "4 questões". */
export const studyItemCount = (kind: "flashcard" | "quizQuestion", count: number) =>
  kind === "flashcard"
    ? `${count} ${count === 1 ? "flashcard" : "flashcards"}`
    : `${count} ${count === 1 ? "questão" : "questões"}`;

/** Portuguese agreement for a participle that refers to those items: "criadas", "adicionado". */
export const studyItemAgreement = (
  kind: "flashcard" | "quizQuestion",
  count: number,
  stem: string,
) => `${stem}${kind === "flashcard" ? "o" : "a"}${count === 1 ? "" : "s"}`;
