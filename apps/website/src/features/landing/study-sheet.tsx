import { useRef } from "react";
import { ArrowUpRight, FileText } from "lucide-react";
import { PaperSurface } from "./paper-surface.tsx";

export type PaperOrigin = {
  x: number;
  y: number;
  width: number;
  height: number;
  ink?: { x: number; y: number; width: number; height: number };
};
export function StudySheet({ onPractice }: { onPractice: (origin: PaperOrigin) => void }) {
  const sheet = useRef<HTMLDivElement>(null);
  return (
    <div className="lp-sheet-stage">
      <PaperSurface />
      <div className="lp-study-sheet" ref={sheet}>
        <span className="lp-sheet-label">
          <FileText size={17} aria-hidden="true" /> Física: por que o céu é azul?
        </span>
        <p>
          A luz <em>azul</em> se espalha
          <br />
          mais do que a vermelha.
        </p>
        <button
          className="lp-sheet-action"
          onClick={() => {
            const rect = sheet.current!.getBoundingClientRect();
            const ink = sheet.current!.querySelector("em")!.getBoundingClientRect();
            onPractice({
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
              ink: { x: ink.x, y: ink.y, width: ink.width, height: ink.height },
            });
          }}
        >
          Experimentar um flashcard <ArrowUpRight aria-hidden="true" size={20} />
        </button>
      </div>
    </div>
  );
}
