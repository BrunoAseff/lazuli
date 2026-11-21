import type { BlockSchema, InlineContentSchema, StyleSchema } from "@blocknote/core";
import { BlockNoteViewRaw, ComponentsContext } from "@blocknote/react";
import { ShadCNComponentsContext, ShadCNDefaultComponents } from "@blocknote/shadcn";
import { useTheme } from "next-themes";
import type { ComponentProps } from "react";

import { lazuliBlockNoteComponents } from "@/components/blocknote-components.tsx";
import { cn } from "@/lib/utils.ts";

/**
 * BlockNote's shadcn view with the app's theme and the app's own forms and image panel (see
 * blocknote-components.tsx): the same wiring as `@blocknote/shadcn`'s BlockNoteView, with our
 * components in place of a few of its.
 */
export const ThemedBlockNoteView = <
  B extends BlockSchema,
  I extends InlineContentSchema,
  S extends StyleSchema,
>({
  className,
  ...props
}: ComponentProps<typeof BlockNoteViewRaw<B, I, S>>) => {
  const { resolvedTheme } = useTheme();
  return (
    <ShadCNComponentsContext.Provider value={ShadCNDefaultComponents}>
      <ComponentsContext.Provider value={lazuliBlockNoteComponents}>
        <BlockNoteViewRaw
          {...props}
          className={cn("bn-shadcn", className)}
          theme={resolvedTheme === "dark" ? "dark" : "light"}
        />
      </ComponentsContext.Provider>
    </ShadCNComponentsContext.Provider>
  );
};
