import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  defaultStyleSpecs,
} from "@blocknote/core";
import { createReactStyleSpec } from "@blocknote/react";

import { lazuliImageBlock } from "./lazuli-image-block.tsx";

const sourceAnchor = createReactStyleSpec(
  { type: "sourceAnchor", propSchema: "string" },
  {
    render: ({ contentRef, value }) => (
      <span className="lazuli-source-anchor" data-anchor-id={value} ref={contentRef} />
    ),
  },
);

export const documentSchema = BlockNoteSchema.create({
  blockSpecs: {
    paragraph: defaultBlockSpecs.paragraph,
    heading: defaultBlockSpecs.heading,
    bulletListItem: defaultBlockSpecs.bulletListItem,
    numberedListItem: defaultBlockSpecs.numberedListItem,
    checkListItem: defaultBlockSpecs.checkListItem,
    quote: defaultBlockSpecs.quote,
    codeBlock: defaultBlockSpecs.codeBlock,
    divider: defaultBlockSpecs.divider,
    image: lazuliImageBlock(),
  },
  inlineContentSpecs: defaultInlineContentSpecs,
  styleSpecs: { ...defaultStyleSpecs, sourceAnchor },
});

export type LazuliDocumentBlock = (typeof documentSchema.Block)[];
