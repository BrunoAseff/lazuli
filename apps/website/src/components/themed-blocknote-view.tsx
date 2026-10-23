import { BlockNoteView } from "@blocknote/shadcn";
import { useTheme } from "next-themes";
import type { ComponentProps } from "react";
import type { BlockSchema, InlineContentSchema, StyleSchema } from "@blocknote/core";

export const ThemedBlockNoteView = <
  B extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema,
>(
  props: ComponentProps<typeof BlockNoteView<B, I, S>>,
) => {
  const { resolvedTheme } = useTheme();
  return <BlockNoteView {...props} theme={resolvedTheme === "dark" ? "dark" : "light"} />;
};
