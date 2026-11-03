import { readdir, readFile } from "node:fs/promises";
import ts from "typescript";

// Production runs plain Node: workspace packages exporting TypeScript must be bundled.
const checkDirectory = async (directory) => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) {
      await checkDirectory(url);
      continue;
    }
    if (!/\.(?:mjs|js)$/.test(entry.name)) continue;
    const source = ts.createSourceFile(
      url.pathname,
      await readFile(url, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    const visit = (node) => {
      const specifier =
        ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
          ? node.moduleSpecifier
          : ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
            ? node.arguments[0]
            : undefined;
      if (
        specifier &&
        ts.isStringLiteral(specifier) &&
        /^@lazuli\/shared(?:\/|$)/.test(specifier.text)
      )
        throw new Error(
          `Unbundled TypeScript workspace import in ${url.pathname}: ${specifier.text}`,
        );
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
};

await checkDirectory(new URL("../dist/", import.meta.url));
console.info("Production bundle verified: no external TypeScript workspace imports.");
