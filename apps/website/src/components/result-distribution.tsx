import "./study-collection-card.css";

type ResultTone = "again" | "hard" | "good" | "easy" | "correct" | "incorrect";

/**
 * How a session or attempt went, as one proportional bar with its key: the same reading as the
 * strip on collection cards. Every category stays in the key (a zero is information); only
 * non-empty ones take space in the bar.
 */
export const ResultDistribution = ({
  label,
  parts,
}: {
  label: string;
  parts: Array<{ count: number; label: string; tone: ResultTone }>;
}) => {
  const visible = parts.filter(({ count }) => count > 0);
  return (
    <div className="result-distribution">
      <span
        aria-label={`${label}: ${parts.map((part) => `${part.count} ${part.label}`).join(", ")}`}
        className="collection-strip result-strip"
        role="img"
      >
        {visible.map((part) => (
          <span
            className="collection-strip-segment"
            data-tone={part.tone}
            key={part.tone}
            style={{ flexGrow: part.count }}
          />
        ))}
      </span>
      <span aria-hidden="true" className="collection-strip-legend">
        {parts.map((part) => (
          <span className="collection-strip-key" data-tone={part.tone} key={part.tone}>
            <span className="collection-strip-swatch" />
            <span>
              {part.label} <span className="tabular-nums text-foreground">{part.count}</span>
            </span>
          </span>
        ))}
      </span>
    </div>
  );
};
