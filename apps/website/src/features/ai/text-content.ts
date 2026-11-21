import type { DocumentBlock } from "@lazuli/shared";

/** A proposal's plain text as the one paragraph a rich field starts from. */
export const textContent = (text: string): DocumentBlock[] => [
  {
    id: crypto.randomUUID(),
    type: "paragraph",
    content: [{ type: "text", text: text.trim(), styles: {} }],
  },
];
