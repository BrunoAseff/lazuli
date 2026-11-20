import { createContext, useContext } from "react";

/**
 * Shared by a creation workspace and what is reviewed inside it. The workspace owns one source pane;
 * what is reviewed can take that pane over (e.g. the list of proposals) through the slot.
 */
export type SourceReadingContextValue = {
  /** Fill the available column with an inner scroll instead of a "read more" toggle. */
  fill: boolean;
  /** Mount point inside the source pane. */
  slot: HTMLElement | null;
  /**
   * Takes the pane over, hiding the default source. The name labels the pane where it collapses
   * (mobile), e.g. "5 questões"; null gives the pane back.
   */
  claim: (name: string | null) => void;
  /** Closes the pane where it collapses, after a choice made in it. */
  collapse: () => void;
};

export const SourceReadingContext = createContext<SourceReadingContextValue | null>(null);

export const useSourceReading = () => useContext(SourceReadingContext);
