import { createHash } from "node:crypto";

import { blockNoteIconTable } from "./blocknote-icon-table.ts";

/*
 * Root-relative, and left out of the dependency pre-bundle (see vite.config.ts), so the icons are
 * served from source and an edit to them shows without clearing Vite's cache.
 */
export const editorIconModule = "/src/components/editor-icons.tsx";
const names = new Map(blockNoteIconTable);
const filler = new Set(["M0 0h24v24H0z", "M0 0h24v24H0V0z"]);

/** One bundled react-icons function: `function Xt(e) { return Z({...})(e); }`. */
const bundledIcon = /function (\w+)\(e\) \{\n\treturn Z\((\{[\s\S]*?\})\)\(e\);\n\}/g;
const bundledRegion = /\/\/#region [^\n]*react-icons\/\w+\/index\.mjs\n([\s\S]*?)\/\/#endregion/g;

const nameOf = (tree: string) => {
  const paths = [...tree.matchAll(/d: "([^"]+)"/g)]
    .map((match) => match[1]!)
    .filter((d) => !filler.has(d));
  return names.get(createHash("sha1").update(paths.join("|")).digest("hex").slice(0, 12));
};

/**
 * Renders BlockNote's controls with the app's icon family. BlockNote bundles its icons, so each
 * bundled icon function is swapped for the app's icon of the same meaning; an icon missing from
 * the table stays as it is, and the build says so.
 */
export const blockNoteIcons = () => ({
  name: "lazuli-blocknote-icons",
  transform(code: string, id: string) {
    if (
      !/@blocknote[/+]react/.test(id) ||
      !id.includes("blocknote-react") ||
      !code.includes("react-icons/")
    )
      return null;
    const unknown: string[] = [];
    let swapped = 0;
    const next = code.replace(bundledRegion, (region) =>
      region.replace(bundledIcon, (whole, fn: string, tree: string) => {
        const name = nameOf(tree);
        if (!name) {
          unknown.push(fn);
          return whole;
        }
        swapped += 1;
        return `function ${fn}(e) {\n\treturn __lazuliEditorIcons.${name}(e);\n}`;
      }),
    );
    if (unknown.length)
      console.warn(
        `[lazuli-blocknote-icons] ${unknown.length} BlockNote icons kept their own look.`,
      );
    if (!swapped) return null;
    return {
      code: `import * as __lazuliEditorIcons from ${JSON.stringify(editorIconModule)};\n${next}`,
      map: null,
    };
  },
});
