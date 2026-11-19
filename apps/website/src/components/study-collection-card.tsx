import type { ReactNode } from "react";

import "./study-collection-card.css";

/**
 * A collection is one object: who it is and what can be done with it on the first line,
 * where it stands in memory on the second. No second frame, no metric columns.
 */
export const StudyCollectionCard = ({
  actions,
  children,
  identity,
  favorite,
}: {
  actions: ReactNode;
  children: ReactNode;
  identity: ReactNode;
  favorite?: ReactNode;
}) => (
  <article className="collection-card">
    <div className="collection-card-identity">{identity}</div>
    <div className="collection-card-actions">
      {favorite}
      {actions}
    </div>
    <div className="collection-card-state">{children}</div>
  </article>
);

export type StudyStripSegment = {
  count: number;
  label: string;
  tone: "rest" | "due" | "new" | "correct" | "incorrect";
};

/**
 * Proportional strip of real counts. The same tones as the index glyphs:
 * consolidated ink, lapis for what is due, an outline for what was never studied.
 */
export const StudyStrip = ({
  emptyLabel,
  label,
  noun,
  segments,
}: {
  emptyLabel: string;
  label: string;
  /** Names what is counted on the first figure, so "7 em dia" reads "7 flashcards em dia". */
  noun: { singular: string; plural: string };
  segments: StudyStripSegment[];
}) => {
  const visible = segments.filter(({ count }) => count > 0);
  const total = visible.reduce((sum, { count }) => sum + count, 0);
  return (
    <div className="collection-strip-wrap">
      <span
        aria-label={label}
        className="collection-strip"
        data-empty={total === 0 || undefined}
        role="img"
      >
        {visible.map((segment) => (
          <span
            className="collection-strip-segment"
            data-tone={segment.tone}
            key={segment.tone}
            style={{ flexGrow: segment.count }}
          />
        ))}
      </span>
      <span className="collection-strip-legend">
        {total === 0
          ? emptyLabel
          : visible.map((segment, index) => (
              <span className="collection-strip-key" data-tone={segment.tone} key={segment.tone}>
                <span aria-hidden="true" className="collection-strip-swatch" />
                <span>
                  <span className="tabular-nums text-foreground">{segment.count}</span>{" "}
                  {index === 0 && `${segment.count === 1 ? noun.singular : noun.plural} `}
                  {segment.label}
                </span>
              </span>
            ))}
      </span>
    </div>
  );
};

export const StudyCollectionNote = ({ children }: { children: ReactNode }) => (
  <p className="collection-card-note">{children}</p>
);
