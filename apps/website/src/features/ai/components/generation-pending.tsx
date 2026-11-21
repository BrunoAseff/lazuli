import { GemLoader } from "@/components/brand-mark.tsx";

/**
 * While the material is cut into proposals: the gem catches light and the proposals take shape as
 * outlines, so the wait shows what is coming instead of a spinner.
 */
export const GenerationPending = () => (
  <div
    className="grid min-h-72 content-center justify-items-center gap-8 text-center"
    role="status"
  >
    <div>
      <GemLoader className="mx-auto mb-4" size={32} />
      <p className="font-medium">Gerando propostas…</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Você pode fechar esta janela e voltar depois.
      </p>
    </div>
    <div aria-hidden="true" className="grid w-full max-w-md gap-2">
      {[0.92, 0.74, 0.84].map((width, index) => (
        <div
          className="generation-ghost rounded-[var(--radius)] border border-border bg-card px-4 py-3"
          key={index}
          style={{ animationDelay: `${index * 180}ms` }}
        >
          <span
            className="block h-2.5 rounded-full bg-muted"
            style={{ width: `${width * 100}%` }}
          />
          <span className="mt-2 block h-2.5 w-1/2 rounded-full bg-muted" />
        </div>
      ))}
    </div>
  </div>
);
