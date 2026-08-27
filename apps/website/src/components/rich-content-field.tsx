import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";

import { LocalizedBlockNoteInput } from "@/features/documents/editor/localized-blocknote-input.tsx";
import { cn } from "@/lib/utils.ts";

const blockNoteComponents = { Input: { Input: LocalizedBlockNoteInput } };

export const RichContentField = ({
  editor,
  error,
  label,
  onChange,
}: {
  editor: ReturnType<typeof useCreateBlockNote>;
  error?: string;
  label: string;
  onChange: () => void;
}) => (
  <section>
    <h3 className="mb-2 text-sm font-medium">{label}</h3>
    <div
      className={cn(
        "min-h-40 border bg-background px-3 py-3 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20",
        error &&
          "border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
      )}
    >
      <BlockNoteView
        className="lazuli-editor lazuli-flashcard-editor"
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
