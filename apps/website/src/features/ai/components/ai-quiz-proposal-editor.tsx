import { collectDocumentTextBlocks, type DocumentBlock } from "@lazuli/shared";
import { useCreateBlockNote } from "@blocknote/react";
import { useRef, useState } from "react";

import { RichContentField } from "@/components/rich-content-field.tsx";
import { resolveAssetUrl } from "@/features/assets/asset-api.ts";
import { lazuliBlockNoteDictionary } from "@/features/documents/editor/blocknote-dictionary.ts";
import {
  documentSchema,
  type LazuliDocumentBlock,
} from "@/features/documents/editor/document-schema.tsx";
import { uploadQuizImage } from "@/features/quizzes/api/quiz-api.ts";
import {
  QuizAlternativesField,
  type QuizOptionDraft,
} from "@/features/quizzes/components/quiz-alternatives-field.tsx";

const textContent = (text: string): DocumentBlock[] => [
  {
    id: crypto.randomUUID(),
    type: "paragraph",
    content: [{ type: "text", text: text.trim(), styles: {} }],
  },
];

export type AiEditableQuizProposal = {
  content?: DocumentBlock[];
  correctOptionIndex: number;
  options: string[];
  prompt: string;
};

export const AiQuizProposalEditor = ({
  id,
  onChange,
  value,
}: {
  id: string;
  onChange: (value: AiEditableQuizProposal) => void;
  value: AiEditableQuizProposal;
}) => {
  const initial = useRef(value);
  const [options, setOptions] = useState<QuizOptionDraft[]>(() =>
    initial.current.options.map((text, index) => ({
      id: crypto.randomUUID(),
      isCorrect: index === initial.current.correctOptionIndex,
      text,
    })),
  );
  const editor = useCreateBlockNote(
    {
      schema: documentSchema,
      initialContent: (initial.current.content ??
        textContent(initial.current.prompt)) as LazuliDocumentBlock,
      dictionary: lazuliBlockNoteDictionary,
      uploadFile: async (file) => (await uploadQuizImage(file)).url,
      resolveFileUrl: resolveAssetUrl,
    },
    [id],
  );

  const emit = (nextOptions: QuizOptionDraft[]) => {
    const content = editor.document as DocumentBlock[];
    onChange({
      content,
      correctOptionIndex: Math.max(
        0,
        nextOptions.findIndex(({ isCorrect }) => isCorrect),
      ),
      options: nextOptions.map(({ text }) => text),
      prompt: collectDocumentTextBlocks(content)
        .map(({ text }) => text)
        .join(" ")
        .trim(),
    });
  };

  return (
    <div className="grid gap-5">
      <RichContentField
        appearance="boxed"
        editor={editor}
        label="Pergunta"
        onChange={() => emit(options)}
      />
      <QuizAlternativesField
        onChange={(next) => {
          setOptions(next);
          emit(next);
        }}
        options={options}
      />
    </div>
  );
};
