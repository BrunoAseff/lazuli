export const calculateFlashcardProgress = (studiedCards: number, totalCards: number) =>
  totalCards === 0 ? 0 : Math.round((studiedCards / totalCards) * 100);
