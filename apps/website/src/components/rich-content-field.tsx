import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";

import { LocalizedBlockNoteInput } from "@/features/documents/editor/localized-blocknote-input.tsx";
import { cn } from "@/lib/utils.ts";

const blockNoteComponents = { Input: { Input: LocalizedBlockNoteInput } };

export const RichContentField = ({
  appearance = "boxed",
  editor,
  editable = true,
  error,
  label,
  onChange,
  workbenchRole,
}: {
  appearance?: "boxed" | "workbench";
  editor: ReturnType<typeof useCreateBlockNote>;
  editable?: boolean;
  error?: string;
  label: string;
  onChange: () => void;
  workbenchRole?: "question" | "answer";
}) => (
  <section className={cn(appearance === "workbench" && "min-h-0")}>
    {label && (
      <h3
        className={cn(
          "mb-2 text-sm font-medium",
          appearance === "workbench" &&
            "mb-4 text-[0.6875rem] tracking-[0.14em] text-primary uppercase",
        )}
      >
        {label}
      </h3>
    )}
    <div
      className={cn(
        "min-h-40 rounded-lg border bg-background px-3 py-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20",
        appearance === "workbench" &&
          "min-h-0 rounded-none border-0 bg-transparent px-0 py-0 focus-within:border-transparent focus-within:ring-0",
        error &&
          "border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
      )}
    >
      <BlockNoteView
        className={cn(
          "lazuli-editor lazuli-flashcard-editor",
          appearance === "workbench" && "lazuli-flashcard-workbench",
          workbenchRole === "question" && "lazuli-flashcard-workbench-question",
          workbenchRole === "answer" && "lazuli-flashcard-workbench-answer",
        )}
        editable={editable}
        editor={editor}
        onChange={onChange}
        shadCNComponents={blockNoteComponents}
        sideMenu={false}
        theme="light"
      />
    </div>
    {error && (
      <p className="mt-1.5 text-xs text-destructive" role="alert">
        {error}
      </p>
    )}
  </section>
);
